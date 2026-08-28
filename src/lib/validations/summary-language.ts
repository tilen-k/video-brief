import { z } from "zod";

import { summaryLanguageSchema } from "@/domain/i18n/summary-language";

export { summaryLanguageSchema };

export const optionalSummaryLanguageSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, summaryLanguageSchema.optional());

export const updateDefaultSummaryLanguageSchema = z.object({
  defaultSummaryLanguage: summaryLanguageSchema,
});

export type UpdateDefaultSummaryLanguageInput = z.infer<
  typeof updateDefaultSummaryLanguageSchema
>;
