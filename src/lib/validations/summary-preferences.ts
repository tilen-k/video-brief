import { z } from "zod";

import { summaryLanguageSchema } from "@/domain/i18n/summary-language";

const prefScoreSchema = z.coerce.number().int().min(0).max(100);

export const updateSummaryPreferencesSchema = z.object({
  defaultSummaryLanguage: summaryLanguageSchema,
  summaryTone: prefScoreSchema,
  summaryLength: prefScoreSchema,
});

export type UpdateSummaryPreferencesInput = z.infer<
  typeof updateSummaryPreferencesSchema
>;
