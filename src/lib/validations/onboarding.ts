import { z } from "zod";

import { optionalSummaryLanguageSchema } from "@/lib/validations/summary-language";

const emptyToUndefined = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
};

const prefScoreSchema = z.preprocess((value) => {
  const emptied = emptyToUndefined(value);
  if (emptied === undefined) {
    return undefined;
  }
  return emptied;
}, z.coerce.number().int().min(0).max(100).optional());

export const onboardingInputSchema = z.object({
  summaryTone: prefScoreSchema,
  summaryLength: prefScoreSchema,
  defaultSummaryLanguage: optionalSummaryLanguageSchema,
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
