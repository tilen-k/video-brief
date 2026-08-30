import { z } from "zod";

export const ANALYSIS_QUEUE_NAME = "analysis";
export const ANALYZE_JOB_NAME = "analyze";

export const analyzeJobDataSchema = z.object({
  userId: z.uuid(),
  userVideoId: z.uuid(),
  runId: z.uuid(),
});

export type AnalyzeJobData = z.infer<typeof analyzeJobDataSchema>;

/** BullMQ forbids ":" in custom job ids (used as an internal separator). */
export function analyzeJobId(userVideoId: string, runId: string): string {
  return `${userVideoId}_${runId}`;
}

export const ANALYSIS_JOB_LOCK_DURATION_MS = 45 * 60 * 1000;
export const ANALYSIS_LOCK_TTL_MS = 45 * 60 * 1000;
