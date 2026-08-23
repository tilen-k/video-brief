import type {
  ClassifyVideoOutput,
  GenerateSectionsOutput,
} from "@/domain/analysis/schemas";
import type { UserProfile } from "@/domain/analysis/get-user-profile";
import type { FamiliarityLevel, SummaryStyle } from "@/lib/validations/onboarding-options";

export type ClassifyVideoInput = {
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  youtubeCategoryId: string | null;
  transcriptExcerpt: string;
};

export type GenerateSectionsInput = {
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  transcriptSubset: string;
  classification: {
    isEducational: boolean;
    confidence: string;
    topic: string | null;
  };
  profile: UserProfile;
  prefs: {
    familiarity: FamiliarityLevel | null;
    summaryLength: SummaryStyle | null;
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
  classifyVideo(input: ClassifyVideoInput): Promise<ClassifyVideoOutput>;
  generateSections(input: GenerateSectionsInput): Promise<GenerateSectionsOutput>;
}
