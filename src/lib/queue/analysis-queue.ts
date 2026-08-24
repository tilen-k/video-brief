import { Queue } from "bullmq";

import { pingRedis, createRedisConnection } from "./redis";
import {
  ANALYZE_JOB_NAME,
  ANALYSIS_QUEUE_NAME,
  analyzeJobId,
  type AnalyzeJobData,
} from "./types";

export async function assertQueueReady(): Promise<void> {
  await pingRedis();
}

export async function enqueueAnalyzeJob(data: AnalyzeJobData): Promise<void> {
  const connection = createRedisConnection("queue");
  const queue = new Queue(ANALYSIS_QUEUE_NAME, { connection });
  try {
    await queue.add(ANALYZE_JOB_NAME, data, {
      jobId: analyzeJobId(data.userVideoId, data.runId),
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });
  } finally {
    await queue.close();
    connection.disconnect();
  }
}
