import { z } from "zod";

import { analysisConfig } from "./config";

const { generate } = analysisConfig;

export const generatedSectionSchema = z.object({
  title: z.string().trim().min(1).max(generate.maxSectionTitleChars),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative(),
  body: z.string().trim().min(1).max(generate.maxBodyChars),
});

export const generateSectionsSchema = z.object({
  summary: z.string().trim().min(1).max(generate.maxSummaryChars),
  sections: z
    .array(generatedSectionSchema)
    .min(1)
    .max(generate.maxSections),
});

export type GeneratedSectionParsed = z.infer<typeof generatedSectionSchema>;
export type GenerateSectionsOutput = z.infer<typeof generateSectionsSchema>;
