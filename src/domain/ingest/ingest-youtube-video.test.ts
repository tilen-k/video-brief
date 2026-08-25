import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TranscriptProviderError,
  type EnglishTranscriptResult,
  type TranscriptProvider,
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
    getEnglishTranscript: vi.fn(),
  }),
}));

vi.mock("@/domain/usage/plan", () => ({
  getPlanForUser: vi.fn(async () => "free"),
}));

import {
  fetchYoutubeVideo,
  startYoutubeIngest,
} from "@/domain/ingest/ingest-youtube-video";

const sampleTranscript: EnglishTranscriptResult = {
  metadata: {
    youtubeId: "dQw4w9WgXcQ",
    title: "Sample video",
    channelTitle: "Channel",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    durationSeconds: 120,
    youtubeCategoryId: "27",
  },
  language: "en",
  segments: [{ startMs: 0, endMs: 1000, text: "Hello" }],
};

function mockProvider(
  impl: TranscriptProvider["getEnglishTranscript"],
): TranscriptProvider {
  return {
    getVideoMetadata: vi.fn(),
    getEnglishTranscript: impl,
  };
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

    expect(provider.getEnglishTranscript).not.toHaveBeenCalled();
    expect(result).toEqual({
      userVideoId: "uv-1",
      analysisId: "analysis-1",
      status: "pending",
      runId: "run-1",
      priorUsageQuotaKey: null,
    });
  });
});

describe("fetchYoutubeVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue([
      { usageQuotaKey: "vb:usage:videos:user-1:202608" },
    ]);
  });

  it("always fetches from provider and lands on generating", async () => {
    const getEnglishTranscript = vi.fn(async () => sampleTranscript);
    const provider = mockProvider(getEnglishTranscript);

    mocks.updateReturning.mockResolvedValueOnce([
      { id: "analysis-1", status: "generating" },
    ]);
    mocks.returning.mockResolvedValueOnce([{ id: "uv-1" }]);

    const result = await fetchYoutubeVideo(
      { userId: "user-1", youtubeId: "dQw4w9WgXcQ", userVideoId: "uv-1", runId: "run-1" },
      { transcriptProvider: provider },
    );

    expect(getEnglishTranscript).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("generating");
    expect(result.userVideoId).toBe("uv-1");
  });

  it("calls provider again on re-paste (no shared cache skip)", async () => {
    const getEnglishTranscript = vi.fn(async () => sampleTranscript);
    const provider = mockProvider(getEnglishTranscript);

    mocks.updateReturning
      .mockResolvedValueOnce([{ id: "analysis-1", status: "generating" }])
      .mockResolvedValueOnce([{ id: "analysis-1", status: "generating" }]);
    mocks.returning
      .mockResolvedValueOnce([{ id: "uv-1" }])
      .mockResolvedValueOnce([{ id: "uv-1" }]);

    const input = {
      userId: "user-1",
      youtubeId: "dQw4w9WgXcQ",
      userVideoId: "uv-1",
      runId: "run-1",
    };
    await fetchYoutubeVideo(input, { transcriptProvider: provider });
    await fetchYoutubeVideo(input, { transcriptProvider: provider });

    expect(getEnglishTranscript).toHaveBeenCalledTimes(2);
  });

  it("only promotes fetching analyses and clears summary/sections", async () => {
    const provider = mockProvider(async () => sampleTranscript);

    mocks.updateReturning.mockResolvedValueOnce([
      { id: "analysis-1", status: "generating" },
    ]);
    mocks.returning.mockResolvedValueOnce([{ id: "uv-1" }]);

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

  it("returns failed when English captions are missing but metadata exists", async () => {
    const provider = mockProvider(async () => {
      throw new TranscriptProviderError(
        "missing_english_captions",
        "This video has no English captions",
        { metadata: sampleTranscript.metadata },
      );
    });
    const refundSlot = vi.fn(async () => undefined);

    mocks.updateReturning.mockResolvedValueOnce([
      { id: "analysis-1", runId: "run-1" },
    ]);
    mocks.returning.mockResolvedValueOnce([{ id: "uv-1" }]);

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
        "missing_english_captions",
        "This video has no English captions",
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

    mocks.updateReturning.mockResolvedValueOnce([
      { id: "analysis-1", runId: "run-1" },
    ]);
    mocks.returning.mockResolvedValueOnce([{ id: "uv-1" }]);

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

    mocks.updateReturning.mockResolvedValueOnce([
      { id: "analysis-1", runId: "run-1" },
    ]);
    mocks.returning.mockResolvedValueOnce([{ id: "uv-1" }]);

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
