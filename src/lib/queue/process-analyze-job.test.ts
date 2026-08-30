import { describe, expect, it, vi } from "vitest";

import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";

import type { AnalysisLockStore } from "./analysis-lock";
import { processAnalyzeJob } from "./process-analyze-job";

const job = {
  userId: "11111111-1111-4111-8111-111111111111",
  userVideoId: "22222222-2222-4222-8222-222222222222",
  runId: "33333333-3333-4333-8333-333333333333",
};

function video(
  status: WorkspaceVideo["status"],
  runId = job.runId,
): WorkspaceVideo {
  return {
    userVideoId: job.userVideoId,
    youtubeId: "dQw4w9WgXcQ",
    title: "Sample",
    channelTitle: "Channel",
    status,
    errorCode: null,
    errorMessage: null,
    familiarity: 50,
    summaryLength: 50,
    summaryTone: 50,
    summary: null,
    runId,
    sections: [],
  };
}

function locks(acquired: boolean): AnalysisLockStore {
  return {
    tryAcquire: vi.fn(async () => acquired),
    heartbeat: vi.fn(async () => true),
    release: vi.fn(async () => undefined),
  };
}

describe("processAnalyzeJob", () => {
  it("loops stages until complete", async () => {
    const continueFn = vi
      .fn()
      .mockResolvedValueOnce(video("fetching"))
      .mockResolvedValueOnce(video("generating"))
      .mockResolvedValueOnce(video("complete"));
    const store = locks(true);

    await processAnalyzeJob(job, {
      locks: store,
      continueAnalysis: continueFn,
    });

    expect(continueFn).toHaveBeenCalledTimes(3);
    expect(continueFn).toHaveBeenCalledWith(job.userId, job.userVideoId, {
      expectedRunId: job.runId,
    });
    expect(store.heartbeat).toHaveBeenCalled();
    expect(store.release).toHaveBeenCalledWith(job.userVideoId, job.runId);
  });

  it("exits when continueAnalysis returns a different run", async () => {
    const continueFn = vi
      .fn()
      .mockResolvedValue(video("fetching", "44444444-4444-4444-8444-444444444444"));
    await processAnalyzeJob(job, {
      locks: locks(true),
      continueAnalysis: continueFn,
    });
    expect(continueFn).toHaveBeenCalledTimes(1);
  });

  it("exits when lock is held by a different run", async () => {
    const continueFn = vi.fn();
    await processAnalyzeJob(job, {
      locks: locks(false),
      continueAnalysis: continueFn,
      getWorkspaceVideo: async () =>
        video("pending", "44444444-4444-4444-8444-444444444444"),
    });
    expect(continueFn).not.toHaveBeenCalled();
  });

  it("delays when the same run already holds the lock", async () => {
    await expect(
      processAnalyzeJob(job, {
        locks: locks(false),
        getWorkspaceVideo: async () => video("fetching"),
      }),
    ).rejects.toMatchObject({
      name: "AnalysisJobDelayError",
      message: "analysis_lock_busy",
    });
  });

  it("throws if a stage does not advance", async () => {
    const continueFn = vi.fn().mockResolvedValue(video("fetching"));
    await expect(
      processAnalyzeJob(job, {
        locks: locks(true),
        continueAnalysis: continueFn,
      }),
    ).rejects.toThrow(/stalled at fetching/);
    expect(continueFn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a domain failed status", async () => {
    const continueFn = vi.fn().mockResolvedValue(video("failed"));
    await processAnalyzeJob(job, {
      locks: locks(true),
      continueAnalysis: continueFn,
    });
    expect(continueFn).toHaveBeenCalledTimes(1);
  });
});
