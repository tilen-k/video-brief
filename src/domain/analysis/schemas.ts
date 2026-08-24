import { z } from "zod";

import { analysisConfig } from "./config";

const { generate } = analysisConfig;

export const classificationConfidenceSchema = z.enum([
  "high",
  "medium",
  "low",
]);

export const classifyVideoSchema = z.object({
  isEducational: z
    .boolean()
    .describe("True if the video teaches or explains something"),
  confidence: classificationConfidenceSchema.describe(
    "How sure you are: high, medium, or low",
  ),
  topic: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional()
    .describe(
      "Short noun phrase for “How familiar are you with {topic}?” Omit if none fits",
    ),
});

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

export type ClassifyVideoOutput = z.infer<typeof classifyVideoSchema>;
export type GeneratedSectionParsed = z.infer<typeof generatedSectionSchema>;
export type GenerateSectionsOutput = z.infer<typeof generateSectionsSchema>;
