import type { TranscriptSegment } from "@/db/schema";

export type VideoMetadata = {
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  youtubeCategoryId: string | null;
};

export type EnglishTranscriptResult = {
  metadata: VideoMetadata;
  language: "en";
  segments: TranscriptSegment[];
};

export type TranscriptProviderErrorCode =
  | "missing_english_captions"
  | "provider_error";

export class TranscriptProviderError extends Error {
  readonly code: TranscriptProviderErrorCode;
  readonly metadata?: VideoMetadata;

  constructor(
    code: TranscriptProviderErrorCode,
    message: string,
    options?: { cause?: unknown; metadata?: VideoMetadata },
  ) {
    super(message, {
      cause: options?.cause instanceof Error ? options.cause : undefined,
    });
    this.name = "TranscriptProviderError";
    this.code = code;
    this.metadata = options?.metadata;
  }
}

/**
 * Swappable YouTube metadata + English transcript source.
 * Callers must not import a concrete transport (youtubei, etc.).
 */
export interface TranscriptProvider {
  /** Metadata only — no captions. Used for library Preview. */
  getVideoMetadata(youtubeId: string): Promise<VideoMetadata>;
  getEnglishTranscript(youtubeId: string): Promise<EnglishTranscriptResult>;
}
