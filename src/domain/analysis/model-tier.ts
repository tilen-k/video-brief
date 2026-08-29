import type { ModelTier, PlanId } from "@/db/schema";

import { analysisConfig } from "./config";

export function isAdvancedModelEnabled(): boolean {
  return process.env.ADVANCED_MODEL_ENABLED !== "0";
}

/** Preference resolution only — quotas are enforced in reserveGenerateSlot. */
export function resolveModelTier(
  _plan: PlanId,
  requested?: ModelTier | null,
): ModelTier {
  if (!isAdvancedModelEnabled()) {
    return "basic";
  }
  if (requested === "basic" || requested === "advanced") {
    return requested;
  }
  return "advanced";
}

export function defaultModelTierForPlan(plan: PlanId): ModelTier {
  return resolveModelTier(plan);
}

export function preferredModelTierFromUsage(
  advancedEnabled: boolean,
  advanced: { used: number; limit: number },
): ModelTier {
  if (!advancedEnabled) {
    return "basic";
  }
  if (advanced.used < advanced.limit) {
    return "advanced";
  }
  return "basic";
}

export function isAdvancedTierAvailable(
  advancedEnabled: boolean,
  advanced: { used: number; limit: number },
): boolean {
  return advancedEnabled && advanced.used < advanced.limit;
}

/** Trust persisted tier; apply kill switch only. */
export function assertRunnableModelTier(
  stored: ModelTier | null | undefined,
): ModelTier {
  if (!isAdvancedModelEnabled()) {
    return "basic";
  }
  return stored === "advanced" ? "advanced" : "basic";
}

export function modelIdForTier(tier: ModelTier): string {
  return tier === "advanced"
    ? analysisConfig.models.advancedId
    : analysisConfig.models.basicId;
}

export function modelIdForPlan(plan: PlanId): string {
  return modelIdForTier(resolveModelTier(plan));
}
