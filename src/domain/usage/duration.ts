import type { ModelTier } from "@/db/schema";
import { analysisConfig } from "@/domain/analysis/config";
import { UsageError } from "@/domain/usage/errors";

function tierLabel(tier: ModelTier): string {
  return tier === "advanced" ? "Advanced" : "Basic";
}

export function maxDurationSecondsForTier(tier: ModelTier): number {
  return analysisConfig.modelTiers[tier].maxDurationSeconds;
}

export function durationExceedsTier(
  tier: ModelTier,
  durationSeconds: number | null,
): boolean {
  if (durationSeconds == null) {
    return true;
  }
  return durationSeconds > maxDurationSecondsForTier(tier);
}

/** Unknown duration cannot fall back to Basic (fail closed). */
export function durationFitsBasicFallback(
  durationSeconds: number | null,
): boolean {
  if (durationSeconds == null) {
    return false;
  }
  return durationSeconds <= maxDurationSecondsForTier("basic");
}

function durationLimitMessage(tier: ModelTier, maxSeconds: number): string {
  const name = tierLabel(tier);
  if (maxSeconds >= 3600 && maxSeconds % 3600 === 0) {
    const hours = maxSeconds / 3600;
    return `This video is longer than the ${hours}-hour ${name} limit. Try a shorter video.`;
  }
  const minutes = Math.round(maxSeconds / 60);
  if (tier === "basic") {
    return `This video is longer than the ${minutes}-minute Basic limit. Switch to Advanced (up to 2 hours) or pick a shorter video.`;
  }
  return `This video is longer than the ${minutes}-minute ${name} limit. Try a shorter video.`;
}

/**
 * Pure duration gate by model tier.
 * Unknown duration fails closed.
 */
export function assertDurationAllowed(
  tier: ModelTier,
  durationSeconds: number | null,
): void {
  const max = maxDurationSecondsForTier(tier);
  if (durationSeconds == null) {
    throw new UsageError(
      "too_long",
      "Couldn't confirm this video's length. Try another video.",
      { tier },
    );
  }
  if (durationSeconds > max) {
    throw new UsageError("too_long", durationLimitMessage(tier, max), { tier });
  }
}
