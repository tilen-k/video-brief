import type { TranscriptSegment } from "@/db/schema";
import {
  TranscriptProviderError,
  type EnglishTranscriptResult,
  type TranscriptProvider,
  type VideoMetadata,
} from "@/lib/youtube/transcript-provider";
import { parseCaptionJson3 } from "@/lib/youtube/parse-caption-json3";

/** InnerTube client that returns working signed caption track URLs (WEB often does not). */
const CAPTION_CLIENT = "IOS" as const;

const CAPTION_USER_AGENT =
  "com.google.ios.youtube/20.10.38 (iPhone16,2; iOS 18.3; en_US)";

type CaptionTrack = {
  base_url?: string;
  language_code?: string;
  kind?: string;
};

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

async function fetchCaptionSegments(baseUrl: string): Promise<TranscriptSegment[]> {
  const response = await fetch(captionTrackUrl(baseUrl), {
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

/**
 * Default TranscriptProvider backed by youtubei.js (Innertube).
 * Uses IOS player caption tracks + timedtext json3 (WEB getTranscript is unreliable).
 * English captions only — missing EN → missing_english_captions.
 */
export class YoutubeiTranscriptProvider implements TranscriptProvider {
  async getEnglishTranscript(
    youtubeId: string,
  ): Promise<EnglishTranscriptResult> {
    let metadata: VideoMetadata | undefined;

    try {
      const { Innertube } = await import("youtubei.js");
      const yt = await Innertube.create();
      const info = await yt.getBasicInfo(youtubeId, { client: CAPTION_CLIENT });

      const basic = info.basic_info;
      const title = basic.title?.toString()?.trim();
      if (!title) {
        throw new TranscriptProviderError(
          "provider_error",
          "Could not load video metadata from YouTube",
        );
      }

      metadata = {
        youtubeId,
        title,
        channelTitle: basic.author ?? basic.channel?.name ?? null,
        thumbnailUrl: pickThumbnail(basic.thumbnail),
        durationSeconds:
          typeof basic.duration === "number" ? basic.duration : null,
        youtubeCategoryId: basic.category ?? null,
      };

      const captionTracks = info.captions?.caption_tracks ?? [];
      const englishTrack = pickEnglishCaptionTrack(captionTracks);
      if (!englishTrack?.base_url) {
        throw new TranscriptProviderError(
          "missing_english_captions",
          "This video has no English captions",
          { metadata },
        );
      }

      const segments = await fetchCaptionSegments(englishTrack.base_url);

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
}

let defaultProvider: TranscriptProvider | null = null;

export function getDefaultTranscriptProvider(): TranscriptProvider {
  if (!defaultProvider) {
    defaultProvider = new YoutubeiTranscriptProvider();
  }
  return defaultProvider;
}
