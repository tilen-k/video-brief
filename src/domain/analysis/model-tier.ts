import type { ModelTier, PlanId } from "@/db/schema";

import { analysisConfig } from "./config";

export function isAdvancedModelEnabled(): boolean {
  return process.env.ADVANCED_MODEL_ENABLED !== "0";
}

export function resolveModelTier(
  plan: PlanId,
  requested?: ModelTier | null,
): ModelTier {
  if (!isAdvancedModelEnabled()) {
    return "basic";
  }
  if (plan === "free") {
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

export function modelIdForTier(tier: ModelTier): string {
  return tier === "advanced"
    ? analysisConfig.models.advancedId
    : analysisConfig.models.basicId;
}

export function modelIdForPlan(plan: PlanId): string {
  return modelIdForTier(resolveModelTier(plan));
}
