import type { PlanId } from "@/db/schema";

/**
 * Product/algorithm knobs for classify + generate + plan limits.
 * Model ids live here, not in env. Secret: OPENROUTER_API_KEY only.
 */
const BASIC_MODEL_ID = "openrouter/free";

export const analysisConfig = {
  model: {
    apiKeyEnv: "OPENROUTER_API_KEY",
    /** Alias of models.basicId for existing call sites. */
    defaultId: BASIC_MODEL_ID,
    timeoutMs: 600_000,
    maxRetries: 1,
  },
  models: {
    // Free router: picks a free model that supports the request (incl. structured JSON).
    // Paid pin later: google/gemini-2.5-flash-lite
    basicId: BASIC_MODEL_ID,
    /** Scaffold only — pin a paid advanced model when Pro ships. */
    advancedId: BASIC_MODEL_ID,
  },
  planLimits: {
    free: {
      videosPerMonth: 10,
      maxDurationSeconds: 20 * 60,
      modelTier: "basic" as const,
    },
    pro: {
      videosPerMonth: 100,
      maxDurationSeconds: null as number | null,
      modelTier: "advanced" as const,
    },
  } satisfies Record<
    PlanId,
    {
      videosPerMonth: number;
      maxDurationSeconds: number | null;
      modelTier: "basic" | "advanced";
    }
  >,
  transcript: {
    charBudget: 12_000,
    classifyCharBudget: 4_000,
    firstWindowMs: 3 * 60 * 1000,
    lastWindowMs: 60 * 1000,
    midWindowMs: 45 * 1000,
    midWindowCount: 4,
  },
  generate: {
    maxOutputTokens: 8192,
    maxSections: 20,
    maxSectionTitleChars: 120,
    maxBodyChars: 2000,
  },
} as const;

export function modelIdForPlan(plan: PlanId): string {
  const tier = analysisConfig.planLimits[plan].modelTier;
  return tier === "advanced"
    ? analysisConfig.models.advancedId
    : analysisConfig.models.basicId;
}
