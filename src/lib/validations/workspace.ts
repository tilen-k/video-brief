import { z } from "zod";

export const userVideoIdSchema = z.uuid();

export type UserVideoId = z.infer<typeof userVideoIdSchema>;
