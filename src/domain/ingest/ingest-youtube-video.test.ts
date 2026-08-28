import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TranscriptProviderError,
  type TranscriptProvider,
  type TranscriptResult,
} from "@/lib/youtube/transcript-provider";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning,
  }));
  const insert = vi.fn(() => ({ values }));

  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const orderBy = vi.fn().mockResolvedValue([]);
  const from = vi.fn(() => ({
    where,
    leftJoin: vi.fn(() => ({ where, orderBy })),
  }));
  const select = vi.fn(() => ({ from }));

  return {
    insert,
    update,
    set,
    returning,
    updateReturning,
    onConflictDoUpdate,
    select,
    limit,
  };
});

vi.mock("@/db", () => ({
  createDb: () => {
    const client = {
      insert: mocks.insert,
      update: mocks.update,
      select: mocks.select,
    };
    return {
      ...client,
      transaction: (fn: (tx: typeof client) => Promise<unknown>) => fn(client),
    };
  },
}));

vi.mock("@/lib/youtube/youtubei-transcript-provider", () => ({
  getDefaultTranscriptProvider: () => ({
    getTranscript: vi.fn(),
  }),
}));

vi.mock("@/domain/usage/plan", () => ({
  getPlanForUser: vi.fn(async () => "free"),
}));

import {
  fetchYoutubeVideo,
  softDeleteUserVideo,
  startYoutubeIngest,
} from "@/domain/ingest/ingest-youtube-video";

const sampleTranscript: TranscriptResult = {
  metadata: {
    youtubeId: "dQw4w9WgXcQ",
    title: "Sample video",
    channelTitle: "Channel",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    durationSeconds: 120,
    youtubeCategoryId: "27",
    primaryLanguage: "en",
  },
  language: "en",
  segments: [{ startMs: 0, endMs: 1000, text: "Hello" }],
};

function mockProvider(
  impl: TranscriptProvider["getTranscript"],
): TranscriptProvider {
  return {
    getVideoMetadata: vi.fn(),
    getTranscript: impl,
  };
}

function mockAnalysisLanguage(summaryLanguage = "en") {
  mocks.limit.mockResolvedValueOnce([{ summaryLanguage }]);
}

describe("startYoutubeIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stubs a library row as pending without calling YouTube", async () => {
    mocks.limit.mockResolvedValueOnce([]);
    mocks.returning
      .mockResolvedValueOnce([{ id: "uv-1" }])
      .mockResolvedValueOnce([{ id: "analysis-1", status: "pending", runId: "run-1" }]);

    const provider = mockProvider(vi.fn());
    const result = await startYoutubeIngest(
      {
        userId: "user-1",
        youtubeId: "dQw4w9WgXcQ",
        familiarity: 40,
        summaryLength: 75,
        summaryTone: 50,
        summaryLanguage: "de",
        usageQuotaKey: "vb:usage:videos:user-1:202608",
        metadata: {
          title: "Sample video",
          channelTitle: "Channel",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          durationSeconds: 120,
          youtubeCategoryId: "27",
        },
      },
      { transcriptProvider: provider },
    );

    expect(provider.getTranscript).not.toHaveBeenCalled();
    expect(result).toEqual({
      userVideoId: "uv-1",
      analysisId: "analysis-1",
      status: "pending",
      runId: "run-1",
      priorUsageQuotaKey: null,
    });
  });

  it("refreshes an active row instead of inserting", async () => {
    mocks.limit
      .mockResolvedValueOnce([{ id: "uv-active" }])
      .mockResolvedValueOnce([{ usageQuotaKey: "vb:usage:videos:user-1:old" }]);
    mocks.returning
      .mockResolvedValueOnce([{ id: "uv-active" }])
      .mockResolvedValueOnce([
        { id: "analysis-1", status: "pending", runId: "run-2" },
      ]);

    const result = await startYoutubeIngest({
      userId: "user-1",
      youtubeId: "dQw4w9WgXcQ",
      familiarity: 40,
      summaryLength: 75,
      summaryTone: 50,
      summaryLanguage: "en",
      usageQuotaKey: "vb:usage:videos:user-1:202608",
      metadata: {
        title: "Sample video",
        channelTitle: "Channel",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        durationSeconds: 120,
        youtubeCategoryId: "27",
      },
    });

    expect(result.userVideoId).toBe("uv-active");
    expect(result.priorUsageQuotaKey).toBe("vb:usage:videos:user-1:old");
    expect(mocks.onConflictDoUpdate).toHaveBeenCalled();
  });

  it("inserts a new row when only soft-deleted rows exist", async () => {
    mocks.limit.mockResolvedValueOnce([]);
    mocks.returning
      .mockResolvedValueOnce([{ id: "uv-new" }])
      .mockResolvedValueOnce([{ id: "analysis-2", status: "pending", runId: "run-3" }]);

    const result = await startYoutubeIngest({
      userId: "user-1",
      youtubeId: "dQw4w9WgXcQ",
      familiarity: null,
      summaryLength: 50,
      summaryTone: 50,
      summaryLanguage: "en",
      usageQuotaKey: "vb:usage:videos:user-1:202608",
    });

    expect(result.userVideoId).toBe("uv-new");
    expect(result.priorUsageQuotaKey).toBeNull();
  });
});

describe("fetchYoutubeVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalysisLanguage("de");
    mocks.limit.mockResolvedValueOnce([
      { usageQuotaKey: "vb:usage:videos:user-1:202608" },
    ]);
  });

  it("always fetches from provider and lands on generating", async () => {
    const getTranscript = vi.fn(async () => sampleTranscript);
    const provider = mockProvider(getTranscript);

    mocks.updateReturning
      .mockResolvedValueOnce([
        { id: "analysis-1", status: "generating", runId: "run-1" },
      ])
      .mockResolvedValueOnce([{ id: "uv-1" }]);

    const result = await fetchYoutubeVideo(
      { userId: "user-1", youtubeId: "dQw4w9WgXcQ", userVideoId: "uv-1", runId: "run-1" },
      { transcriptProvider: provider },
    );

    expect(getTranscript).toHaveBeenCalledWith("dQw4w9WgXcQ", {
      preferredLanguage: "de",
    });
    expect(result.status).toBe("generating");
    expect(result.userVideoId).toBe("uv-1");
  });

  it("calls provider again on re-paste (no shared cache skip)", async () => {
    const getTranscript = vi.fn(async () => sampleTranscript);
    const provider = mockProvider(getTranscript);

    mocks.updateReturning
      .mockResolvedValueOnce([{ id: "analysis-1", status: "generating", runId: "run-1" }])
      .mockResolvedValueOnce([{ id: "uv-1" }])
      .mockResolvedValueOnce([{ id: "analysis-1", status: "generating", runId: "run-1" }])
      .mockResolvedValueOnce([{ id: "uv-1" }]);

    mockAnalysisLanguage("de");
    mocks.limit.mockResolvedValueOnce([
      { usageQuotaKey: "vb:usage:videos:user-1:202608" },
    ]);

    const input = {
      userId: "user-1",
      youtubeId: "dQw4w9WgXcQ",
      userVideoId: "uv-1",
      runId: "run-1",
    };
    await fetchYoutubeVideo(input, { transcriptProvider: provider });
    mockAnalysisLanguage("de");
    mocks.limit.mockResolvedValueOnce([
      { usageQuotaKey: "vb:usage:videos:user-1:202608" },
    ]);
    await fetchYoutubeVideo(input, { transcriptProvider: provider });

    expect(getTranscript).toHaveBeenCalledTimes(2);
  });

  it("only promotes fetching analyses and clears summary/sections", async () => {
    const provider = mockProvider(async () => sampleTranscript);

    mocks.updateReturning
      .mockResolvedValueOnce([
        { id: "analysis-1", status: "generating", runId: "run-1" },
      ])
      .mockResolvedValueOnce([{ id: "uv-1" }]);

    await fetchYoutubeVideo(
      { userId: "user-1", youtubeId: "dQw4w9WgXcQ", userVideoId: "uv-1", runId: "run-1" },
      { transcriptProvider: provider },
    );

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "generating",
        sections: [],
        summary: null,
      }),
    );
    expect(mocks.update).toHaveBeenCalled();
  });

  it("returns failed when captions are missing but metadata exists", async () => {
    const provider = mockProvider(async () => {
      throw new TranscriptProviderError(
        "missing_captions",
        "This video has no captions in your chosen language or the video's original language.",
        { metadata: sampleTranscript.metadata },
      );
    });
    const refundSlot = vi.fn(async () => undefined);

    mocks.updateReturning
      .mockResolvedValueOnce([
        { id: "analysis-1", runId: "run-1" },
      ])
      .mockResolvedValueOnce([{ id: "uv-1" }]);

    const result = await fetchYoutubeVideo(
      {
        userId: "user-1",
        youtubeId: "dQw4w9WgXcQ",
        userVideoId: "uv-1",
        runId: "run-1",
      },
      { transcriptProvider: provider, refundSlot },
    );

    expect(result).toEqual({
      userVideoId: "uv-1",
      analysisId: "analysis-1",
      status: "failed",
      runId: "run-1",
    });
    expect(mocks.update).toHaveBeenCalled();
    expect(refundSlot).toHaveBeenCalledWith("user-1", {
      redisKey: "vb:usage:videos:user-1:202608",
    });
  });

  it("marks the stub failed when metadata is unavailable", async () => {
    const provider = mockProvider(async () => {
      throw new TranscriptProviderError(
        "missing_captions",
        "This video has no captions in your chosen language or the video's original language.",
      );
    });
    const refundSlot = vi.fn(async () => undefined);

    mocks.updateReturning.mockResolvedValueOnce([{ id: "analysis-1", runId: "run-1" }]);

    const result = await fetchYoutubeVideo(
      {
        userId: "user-1",
        youtubeId: "dQw4w9WgXcQ",
        userVideoId: "uv-1",
        runId: "run-1",
      },
      { transcriptProvider: provider, refundSlot },
    );

    expect(result.status).toBe("failed");
    expect(mocks.update).toHaveBeenCalled();
    expect(refundSlot).toHaveBeenCalledWith("user-1", {
      redisKey: "vb:usage:videos:user-1:202608",
    });
  });

  it("fails too_long and refunds when free duration is exceeded", async () => {
    const longTranscript = {
      ...sampleTranscript,
      metadata: {
        ...sampleTranscript.metadata,
        durationSeconds: 21 * 60,
      },
    };
    const provider = mockProvider(async () => longTranscript);
    const refundSlot = vi.fn(async () => undefined);

    mocks.updateReturning
      .mockResolvedValueOnce([
        { id: "analysis-1", runId: "run-1" },
      ])
      .mockResolvedValueOnce([{ id: "uv-1" }]);

    const result = await fetchYoutubeVideo(
      {
        userId: "user-1",
        youtubeId: "dQw4w9WgXcQ",
        userVideoId: "uv-1",
        runId: "run-1",
      },
      {
        transcriptProvider: provider,
        refundSlot,
        getPlan: async () => "free",
      },
    );

    expect(result.status).toBe("failed");
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorCode: "too_long",
      }),
    );
    expect(refundSlot).toHaveBeenCalledWith("user-1", {
      redisKey: "vb:usage:videos:user-1:202608",
    });
  });

  it("does not refund provider_error failures", async () => {
    const provider = mockProvider(async () => {
      throw new TranscriptProviderError(
        "provider_error",
        "YouTube is unavailable",
        { metadata: sampleTranscript.metadata },
      );
    });
    const refundSlot = vi.fn(async () => undefined);

    mocks.updateReturning
      .mockResolvedValueOnce([
        { id: "analysis-1", runId: "run-1" },
      ])
      .mockResolvedValueOnce([{ id: "uv-1" }]);

    await fetchYoutubeVideo(
      {
        userId: "user-1",
        youtubeId: "dQw4w9WgXcQ",
        userVideoId: "uv-1",
        runId: "run-1",
      },
      { transcriptProvider: provider, refundSlot },
    );

    expect(refundSlot).not.toHaveBeenCalled();
  });
});

describe("softDeleteUserVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets deleted_at on an active owned row", async () => {
    mocks.updateReturning.mockResolvedValueOnce([{ id: "uv-1" }]);

    const result = await softDeleteUserVideo("user-1", "uv-1");

    expect(result).toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
      }),
    );
  });

  it("returns not_found when no active row is updated", async () => {
    mocks.updateReturning.mockResolvedValueOnce([]);

    const result = await softDeleteUserVideo("user-1", "uv-missing");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
