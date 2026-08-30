import type { ModelTier, PlanId } from "@/db/schema";

/**
 * Product/algorithm knobs for generate + plan limits.
 * Model ids live here, not in env. Secret: OPENROUTER_API_KEY only.
 * Set ADVANCED_MODEL_ENABLED=0 to disable the advanced tier at runtime.
 */
const BASIC_MODEL_ID = "openrouter/free";
const ADVANCED_MODEL_ID = "google/gemini-2.5-flash-lite";

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
    basicId: BASIC_MODEL_ID,
    advancedId: ADVANCED_MODEL_ID,
  },
  modelTiers: {
    basic: {
      maxDurationSeconds: 20 * 60,
      transcriptCharBudget: 12_000,
      maxOutputTokens: 8192,
    },
    advanced: {
      maxDurationSeconds: 2 * 60 * 60,
      transcriptCharBudget: 200_000,
      maxOutputTokens: 15_000,
    },
  } satisfies Record<
    ModelTier,
    {
      maxDurationSeconds: number;
      transcriptCharBudget: number;
      maxOutputTokens: number;
    }
  >,
  planLimits: {
    free: {
      daily: {
        basic: 10,
        advanced: 5,
      },
    },
    pro: {
      daily: {
        basic: 20,
        advanced: 15,
      },
    },
  } satisfies Record<
    PlanId,
    {
      daily: {
        basic: number;
        advanced: number;
      };
    }
  >,
  usageLimits: {
    global: {
      basic: { hourly: 20, daily: 50 },
      advanced: { hourly: 10, daily: 20 },
    },
    ip: {
      basic: { daily: 15 },
      advanced: { daily: 35 },
    },
  },
  generate: {
    maxSections: 20,
    maxSectionTitleChars: 120,
    maxBodyChars: 2000,
    maxSummaryChars: 2000,
  },
} as const;
