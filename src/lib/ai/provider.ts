import type { GenerateSectionsOutput } from "@/domain/analysis/schemas";

export type GenerateSectionsInput = {
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  transcriptSubset: string;
  outputLanguage: string;
  transcriptLanguage: string;
  prefs: {
    summaryLength: number;
    summaryTone: number;
    familiarity: number | null;
  };
};

export class AIProviderError extends Error {
  readonly code = "provider_error" as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      cause: options?.cause instanceof Error ? options.cause : undefined,
    });
    this.name = "AIProviderError";
  }
}

/**
 * Swappable LLM backend. Callers must not import a concrete SDK/transport.
 */
export interface AIProvider {
  generateSections(input: GenerateSectionsInput): Promise<GenerateSectionsOutput>;
}
