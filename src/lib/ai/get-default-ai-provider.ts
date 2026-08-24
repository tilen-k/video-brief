import type { PlanId } from "@/db/schema";
import { modelIdForPlan } from "@/domain/analysis/config";

import { OpenRouterAIProvider } from "./openrouter-ai-provider";
import type { AIProvider } from "./provider";

const providersByModel = new Map<string, AIProvider>();

export function getDefaultAIProvider(): AIProvider {
  return getAIProviderForPlan("free");
}

export function getAIProviderForPlan(plan: PlanId): AIProvider {
  const modelId = modelIdForPlan(plan);
  const existing = providersByModel.get(modelId);
  if (existing) {
    return existing;
  }
  const provider = new OpenRouterAIProvider(modelId);
  providersByModel.set(modelId, provider);
  return provider;
}
