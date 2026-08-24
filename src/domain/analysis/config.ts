/**
 * Product/algorithm knobs for classify + generate.
 * Model id lives here, not in env. Secret: OPENROUTER_API_KEY only.
 */
export const analysisConfig = {
  model: {
    apiKeyEnv: "OPENROUTER_API_KEY",
    // Free router: picks a free model that supports the request (incl. structured JSON).
    // Paid pin later: google/gemini-2.5-flash-lite
    defaultId: "openrouter/free",
    timeoutMs: 600_000,
    maxRetries: 1,
  },
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
    maxSummaryChars: 2000,
  },
} as const;
