import { DelayedError, Worker } from "bullmq";

import { failAnalysisRun } from "@/domain/ingest/ingest-youtube-video";
import { createAnalysisLocks } from "@/lib/queue/analysis-lock";
import {
  AnalysisJobDelayError,
  processAnalyzeJob,
} from "@/lib/queue/process-analyze-job";
import { createRedisConnection } from "@/lib/queue/redis";
import {
  ANALYSIS_JOB_LOCK_DURATION_MS,
  ANALYSIS_QUEUE_NAME,
  analyzeJobDataSchema,
} from "@/lib/queue/types";
import { errorFields, logger } from "@/lib/logger";

const connection = createRedisConnection("worker");
const locks = createAnalysisLocks(connection);

const worker = new Worker(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const data = analyzeJobDataSchema.parse(job.data);
    try {
      await processAnalyzeJob(data, { locks });
    } catch (error) {
      if (error instanceof AnalysisJobDelayError) {
        await job.moveToDelayed(Date.now() + error.delayMs, job.token);
        throw new DelayedError();
      }
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
    lockDuration: ANALYSIS_JOB_LOCK_DURATION_MS,
  },
);

worker.on("failed", (job, error) => {
  logger.warn(
    {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      ...errorFields(error),
    },
    "analysis.worker.failed",
  );

  const maxAttempts = job?.opts.attempts ?? 1;
  if (!job || job.attemptsMade < maxAttempts) {
    return;
  }

  const parsed = analyzeJobDataSchema.safeParse(job.data);
  if (!parsed.success) {
    return;
  }

  void failAnalysisRun(
    parsed.data.userId,
    parsed.data.userVideoId,
    parsed.data.runId,
  ).catch((failError: unknown) => {
    logger.error(
      { jobId: job.id, ...errorFields(failError) },
      "analysis.worker.fail_persist",
    );
  });
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "analysis.worker.completed");
});

async function shutdown() {
  logger.info("analysis.worker.shutdown");
  await worker.close();
  connection.disconnect();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

logger.info("analysis.worker.started");
