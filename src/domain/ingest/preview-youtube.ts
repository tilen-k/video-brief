import { showFamiliaritySlider } from "@/domain/analysis/familiarity-categories";
import {
  TranscriptProviderError,
  type TranscriptProvider,
  type VideoMetadata,
} from "@/lib/youtube/transcript-provider";
import { getDefaultTranscriptProvider } from "@/lib/youtube/youtubei-transcript-provider";

export type PreviewYoutubeResult = VideoMetadata & {
  showFamiliarity: boolean;
};

export type PreviewYoutubeDeps = {
  transcriptProvider?: TranscriptProvider;
};

/**
 * Metadata-only preview. No DB writes, no usage, no queue.
 */
export async function previewYoutubeVideo(
  youtubeId: string,
  deps: PreviewYoutubeDeps = {},
): Promise<PreviewYoutubeResult> {
  const provider = deps.transcriptProvider ?? getDefaultTranscriptProvider();

  let metadata: VideoMetadata;
  try {
    metadata = await provider.getVideoMetadata(youtubeId);
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

  return {
    ...metadata,
    showFamiliarity: showFamiliaritySlider(metadata.youtubeCategoryId),
  };
}
