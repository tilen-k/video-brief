import type { TranscriptSegment } from "@/db/schema";
import {
  TranscriptProviderError,
  type EnglishTranscriptResult,
  type TranscriptProvider,
  type VideoMetadata,
} from "@/lib/youtube/transcript-provider";
import { parseCaptionJson3 } from "@/lib/youtube/parse-caption-json3";
import {
  createYoutubeFetch,
  shouldRetryTranscriptFetch,
  type YoutubeFetchSession,
} from "@/lib/youtube/proxied-fetch";
import { getYoutubeProxyConfig } from "@/lib/youtube/youtube-proxy-url";

/**
 * WEB/MWEB return PlayerMicroformat.category (English label).
 * IOS/ANDROID omit microformat → category is always null.
 */
const METADATA_CLIENT = "WEB" as const;

/** InnerTube client that returns working signed caption track URLs (WEB often does not). */
const CAPTION_CLIENT = "IOS" as const;

const CAPTION_USER_AGENT =
  "com.google.ios.youtube/20.10.38 (iPhone16,2; iOS 18.3; en_US)";

type CaptionTrack = {
  base_url?: string;
  language_code?: string;
  kind?: string;
};

type YoutubeiModule = typeof import("youtubei.js");
type InnertubeInstance = Awaited<
  ReturnType<YoutubeiModule["Innertube"]["create"]>
>;
type BasicInfo = Awaited<ReturnType<InnertubeInstance["getBasicInfo"]>>;
type BasicInfoFields = BasicInfo["basic_info"];

function pickThumbnail(
  thumbnails: Array<{ url: string }> | undefined,
): string | null {
  if (!thumbnails?.length) {
    return null;
  }
  return thumbnails[thumbnails.length - 1]?.url ?? thumbnails[0]?.url ?? null;
}

function isEnglishLabel(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase().replaceAll("_", "-");
  return (
    normalized === "en" ||
    normalized.startsWith("en-") ||
    normalized.includes("english")
  );
}

function pickEnglishCaptionTrack(
  tracks: CaptionTrack[],
): CaptionTrack | undefined {
  return (
    tracks.find(
      (track) => isEnglishLabel(track.language_code) && track.kind !== "asr",
    ) ?? tracks.find((track) => isEnglishLabel(track.language_code))
  );
}

function captionTrackUrl(baseUrl: string): string {
  const withoutFmt = baseUrl.replace(/&fmt=[^&]+/, "");
  return `${withoutFmt}&fmt=json3`;
}

function mapBasicInfoToMetadata(
  youtubeId: string,
  basic: BasicInfoFields,
): VideoMetadata | null {
  const title = basic.title?.toString()?.trim();
  if (!title) {
    return null;
  }

  return {
    youtubeId,
    title,
    channelTitle: basic.author ?? basic.channel?.name ?? null,
    thumbnailUrl: pickThumbnail(basic.thumbnail),
    durationSeconds:
      typeof basic.duration === "number" ? basic.duration : null,
    // English label from PlayerMicroformat (e.g. "Education"), not Data API id.
    youtubeCategoryId: basic.category ?? null,
  };
}

function requireMetadata(
  youtubeId: string,
  basic: BasicInfoFields,
): VideoMetadata {
  const metadata = mapBasicInfoToMetadata(youtubeId, basic);
  if (!metadata) {
    throw new TranscriptProviderError(
      "provider_error",
      "Could not load video metadata from YouTube",
    );
  }
  return metadata;
}

async function fetchCaptionSegments(
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<TranscriptSegment[]> {
  const response = await fetchImpl(captionTrackUrl(baseUrl), {
    headers: { "User-Agent": CAPTION_USER_AGENT },
  });

  if (!response.ok) {
    throw new TranscriptProviderError(
      "provider_error",
      "Could not fetch the video transcript from YouTube",
    );
  }

  const raw = await response.text();
  const segments = parseCaptionJson3(raw);
  if (segments.length === 0) {
    throw new TranscriptProviderError(
      "provider_error",
      "Could not fetch the video transcript from YouTube",
    );
  }

  return segments;
}

async function createInnertube(
  youtubei: YoutubeiModule,
  youtubeFetch: YoutubeFetchSession,
): Promise<InnertubeInstance> {
  return youtubei.Innertube.create({ fetch: youtubeFetch.fetch });
}

async function fetchVideoMetadataOnce(
  youtubeId: string,
  youtubei: YoutubeiModule,
  youtubeFetch: YoutubeFetchSession,
): Promise<VideoMetadata> {
  try {
    const yt = await createInnertube(youtubei, youtubeFetch);
    const info = await yt.getBasicInfo(youtubeId, { client: METADATA_CLIENT });
    return requireMetadata(youtubeId, info.basic_info);
  } catch (error) {
    if (error instanceof TranscriptProviderError) {
      throw error;
    }
    throw new TranscriptProviderError(
      "provider_error",
      "Could not load video metadata from YouTube",
      { cause: error },
    );
  }
}

async function fetchEnglishTranscriptOnce(
  youtubeId: string,
  youtubei: YoutubeiModule,
  youtubeFetch: YoutubeFetchSession,
): Promise<EnglishTranscriptResult> {
  let metadata: VideoMetadata | undefined;

  try {
    const yt = await createInnertube(youtubei, youtubeFetch);

    // WEB for category + display metadata; IOS for signed caption track URLs.
    const [webResult, iosResult] = await Promise.allSettled([
      yt.getBasicInfo(youtubeId, { client: METADATA_CLIENT }),
      yt.getBasicInfo(youtubeId, { client: CAPTION_CLIENT }),
    ]);

    if (iosResult.status === "rejected") {
      throw iosResult.reason;
    }

    const iosInfo = iosResult.value;
    const webMetadata =
      webResult.status === "fulfilled"
        ? mapBasicInfoToMetadata(youtubeId, webResult.value.basic_info)
        : null;
    metadata =
      webMetadata ?? requireMetadata(youtubeId, iosInfo.basic_info);

    const englishTrack = pickEnglishCaptionTrack(
      iosInfo.captions?.caption_tracks ?? [],
    );
    if (!englishTrack?.base_url) {
      throw new TranscriptProviderError(
        "missing_english_captions",
        "This video has no English captions",
        { metadata },
      );
    }

    const segments = await fetchCaptionSegments(
      englishTrack.base_url,
      youtubeFetch.fetch,
    );

    return {
      metadata,
      language: "en",
      segments,
    };
  } catch (error) {
    if (error instanceof TranscriptProviderError) {
      throw error;
    }
    throw new TranscriptProviderError(
      "provider_error",
      "Could not fetch the video transcript from YouTube",
      { cause: error, metadata },
    );
  }
}

async function withYoutubeSession<T>(
  run: (
    youtubei: YoutubeiModule,
    youtubeFetch: YoutubeFetchSession,
  ) => Promise<T>,
  errorMessage: string,
): Promise<T> {
  const youtubei = await import("youtubei.js");
  const baseFetch: typeof fetch = (input, init) =>
    youtubei.Platform.shim.fetch(input, init);

  let proxyConfigured = false;
  try {
    proxyConfigured = getYoutubeProxyConfig() !== null;
  } catch (error) {
    throw new TranscriptProviderError("provider_error", errorMessage, {
      cause: error,
    });
  }

  const attempt = async () => {
    const youtubeFetch = createYoutubeFetch(baseFetch);
    try {
      return await run(youtubei, youtubeFetch);
    } finally {
      await youtubeFetch.close();
    }
  };

  try {
    return await attempt();
  } catch (error) {
    if (!shouldRetryTranscriptFetch(error, proxyConfigured)) {
      throw error;
    }
    return attempt();
  }
}

/**
 * Default TranscriptProvider backed by youtubei.js (Innertube).
 * Dual client: WEB for metadata/category; IOS for caption tracks + timedtext json3.
 * English captions only — missing EN → missing_english_captions.
 * Optional YOUTUBE_PROXY_URL: same proxied fetch for Innertube + captions, one sticky session.
 */
export class YoutubeiTranscriptProvider implements TranscriptProvider {
  async getVideoMetadata(youtubeId: string): Promise<VideoMetadata> {
    return withYoutubeSession(
      (youtubei, youtubeFetch) =>
        fetchVideoMetadataOnce(youtubeId, youtubei, youtubeFetch),
      "Could not load video metadata from YouTube",
    );
  }

  async getEnglishTranscript(
    youtubeId: string,
  ): Promise<EnglishTranscriptResult> {
    return withYoutubeSession(
      (youtubei, youtubeFetch) =>
        fetchEnglishTranscriptOnce(youtubeId, youtubei, youtubeFetch),
      "Could not fetch the video transcript from YouTube",
    );
  }
}

let defaultProvider: TranscriptProvider | null = null;

export function getDefaultTranscriptProvider(): TranscriptProvider {
  if (!defaultProvider) {
    defaultProvider = new YoutubeiTranscriptProvider();
  }
  return defaultProvider;
}
