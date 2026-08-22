import { z } from "zod";

import { ANALYSIS_STATUSES } from "@/db/schema";
import { parseYoutubeId } from "@/lib/youtube/parse-url";

export { parseYoutubeId, addVideoInputSchema } from "@/lib/youtube/parse-url";

export const analysisStatusSchema = z.enum(ANALYSIS_STATUSES);

export function youtubeUrlOrIdSchema() {
  return z
    .string()
    .trim()
    .min(1)
    .refine((value) => parseYoutubeId(value) !== null, {
      message: "That doesn’t look like a YouTube video URL",
    });
}
