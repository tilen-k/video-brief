import { z } from "zod";

import { parseYoutubeId } from "@/lib/youtube/parse-url";
import { optionalSummaryLanguageSchema } from "@/lib/validations/summary-language";

const prefScoreSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.coerce.number().int().min(0).max(100).optional());

const nullableFamiliaritySchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return value;
}, z.coerce.number().int().min(0).max(100).nullable());

export const previewYoutubeInputSchema = z
  .object({
    url: z.string().trim().min(1, "Paste a YouTube URL"),
  })
  .transform((data, ctx) => {
    const youtubeId = parseYoutubeId(data.url);
    if (!youtubeId) {
      ctx.addIssue({
        code: "custom",
        message: "That doesn’t look like a YouTube video URL",
        path: ["url"],
      });
      return z.NEVER;
    }
    return { url: data.url, youtubeId };
  });

export type PreviewYoutubeInput = z.infer<typeof previewYoutubeInputSchema>;

/** Familiarity gating happens in generateVideo from server metadata, not client category. */
export const generateVideoInputSchema = z
  .object({
    youtubeId: z.string().trim().min(1),
    summaryLength: prefScoreSchema,
    summaryTone: prefScoreSchema,
    summaryLanguage: optionalSummaryLanguageSchema,
    familiarity: nullableFamiliaritySchema,
  })
  .transform((data, ctx) => {
    const youtubeId = parseYoutubeId(data.youtubeId) ?? data.youtubeId;
    if (!/^[\w-]{11}$/.test(youtubeId)) {
      ctx.addIssue({
        code: "custom",
        message: "That doesn’t look like a YouTube video URL",
        path: ["youtubeId"],
      });
      return z.NEVER;
    }

    return {
      youtubeId,
      summaryLength: data.summaryLength,
      summaryTone: data.summaryTone,
      summaryLanguage: data.summaryLanguage,
      familiarity: data.familiarity,
    };
  });

export type GenerateVideoInput = z.infer<typeof generateVideoInputSchema>;

export const softDeleteLibraryVideoInputSchema = z.object({
  userVideoId: z.uuid(),
});

export type SoftDeleteLibraryVideoInput = z.infer<
  typeof softDeleteLibraryVideoInputSchema
>;
