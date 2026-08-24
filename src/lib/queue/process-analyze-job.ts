import type { AnalysisStatus } from "@/db/schema";
import { continueAnalysis } from "@/domain/analysis/continue-analysis";
import { getWorkspaceVideo } from "@/domain/workspace/get-workspace-video";

import type { AnalysisLockStore } from "./analysis-lock";
import type { AnalyzeJobData } from "./types";

const WORK_STATUSES: AnalysisStatus[] = [
  "pending",
  "fetching",
  "classifying",
  "generating",
];

export class AnalysisJobDelayError extends Error {
  readonly delayMs: number;

  constructor(delayMs = 5_000) {
    super("analysis_lock_busy");
    this.name = "AnalysisJobDelayError";
    this.delayMs = delayMs;
  }
}

export type ProcessAnalyzeJobDeps = {
  continueAnalysis?: typeof continueAnalysis;
  getWorkspaceVideo?: typeof getWorkspaceVideo;
  locks: AnalysisLockStore;
};

export async function processAnalyzeJob(
  job: AnalyzeJobData,
  deps: ProcessAnalyzeJobDeps,
): Promise<void> {
  const continueFn = deps.continueAnalysis ?? continueAnalysis;
  const loadVideo = deps.getWorkspaceVideo ?? getWorkspaceVideo;

  const acquired = await deps.locks.tryAcquire(job.userVideoId, job.runId);
  if (!acquired) {
    const current = await loadVideo(job.userId, job.userVideoId);
    if (!current || current.runId !== job.runId) {
      return;
    }
    throw new AnalysisJobDelayError();
  }

  try {
    let lastStatus: AnalysisStatus | undefined;
    for (;;) {
      const renewed = await deps.locks.heartbeat(job.userVideoId, job.runId);
      if (!renewed) {
        throw new Error("analysis lock expired");
      }
      const video = await continueFn(job.userId, job.userVideoId, {
        expectedRunId: job.runId,
      });
      if (!video || video.runId !== job.runId) {
        return;
      }
      if (video.status === "complete" || video.status === "failed") {
        return;
      }
      if (!WORK_STATUSES.includes(video.status)) {
        return;
      }
      if (lastStatus === video.status) {
        throw new Error(`analysis stalled at ${video.status}`);
      }
      lastStatus = video.status;
    }
  } finally {
    await deps.locks.release(job.userVideoId, job.runId);
  }
}
