import type { ModelTier, TranscriptSegment } from "@/db/schema";
import { UsageError } from "@/domain/usage/errors";

import { analysisConfig } from "./config";

export function formatTranscriptTimestamp(startMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  return `[${totalSeconds}]`;
}

export function formatTranscriptLine(segment: TranscriptSegment): string {
  return `${formatTranscriptTimestamp(segment.startMs)} ${segment.text.trim()}`;
}

/** Full caption dump: `[seconds] text` lines joined by newline. */
export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments.map(formatTranscriptLine).join("\n");
}

export function transcriptCharBudgetForTier(tier: ModelTier): number {
  return analysisConfig.modelTiers[tier].transcriptCharBudget;
}

export function assertTranscriptWithinBudget(
  formatted: string,
  tier: ModelTier,
): void {
  const budget = transcriptCharBudgetForTier(tier);
  if (formatted.length > budget) {
    const name = tier === "advanced" ? "Advanced" : "Basic";
    throw new UsageError(
      "transcript_too_large",
      `This video's transcript is too long for the ${name} model. Try a shorter video.`,
      { tier },
    );
  }
}
