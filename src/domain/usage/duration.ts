import type { PlanId } from "@/db/schema";
import { analysisConfig } from "@/domain/analysis/config";
import { UsageError } from "@/domain/usage/errors";

/**
 * Pure duration gate.
 * Unknown duration fails closed on plans that enforce a max (free).
 */
export function assertDurationAllowed(
  plan: PlanId,
  durationSeconds: number | null,
): void {
  const max = analysisConfig.planLimits[plan].maxDurationSeconds;
  if (max == null) {
    return;
  }
  if (durationSeconds == null) {
    throw new UsageError(
      "too_long",
      "Couldn't confirm this video's length. Try another video, or upgrade for longer videos.",
    );
  }
  if (durationSeconds > max) {
    const minutes = Math.round(max / 60);
    throw new UsageError(
      "too_long",
      `This video is longer than the ${minutes}-minute limit on your plan.`,
    );
  }
}
