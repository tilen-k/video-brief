import { z } from "zod";

import { FAMILIARITY_LEVELS, SUMMARY_STYLES } from "./onboarding-options";

export const userVideoIdSchema = z.uuid();

export type UserVideoId = z.infer<typeof userVideoIdSchema>;

export const submitVideoPrefsInputSchema = z.object({
  userVideoId: userVideoIdSchema,
  familiarity: z.enum(FAMILIARITY_LEVELS).optional(),
  summaryLength: z.enum(SUMMARY_STYLES).optional(),
});

export type SubmitVideoPrefsInput = z.infer<typeof submitVideoPrefsInputSchema>;
