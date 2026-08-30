import type { ModelTier, PlanId } from "@/db/schema";
import { analysisConfig } from "@/domain/analysis/config";
import {
  modelIdForTier,
  resolveModelTier,
} from "@/domain/analysis/model-tier";

import { OpenRouterAIProvider } from "./openrouter-ai-provider";
import type { AIProvider } from "./provider";

const providersByModel = new Map<string, AIProvider>();

export function getDefaultAIProvider(): AIProvider {
  return getAIProviderForPlan("free");
}

export function getAIProviderForTier(tier: ModelTier): AIProvider {
  const modelId = modelIdForTier(tier);
  const existing = providersByModel.get(modelId);
  if (existing) {
    return existing;
  }
  const provider = new OpenRouterAIProvider(
    modelId,
    analysisConfig.modelTiers[tier].maxOutputTokens,
  );
  providersByModel.set(modelId, provider);
  return provider;
}

export function getAIProviderForPlan(plan: PlanId): AIProvider {
  return getAIProviderForTier(resolveModelTier(plan));
}
