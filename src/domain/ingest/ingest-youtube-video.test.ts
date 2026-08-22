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

  const updateWhere = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const orderBy = vi.fn().mockResolvedValue([]);
  const from = vi.fn(() => ({ where, leftJoin: vi.fn(() => ({ where, orderBy })) }));
  const select = vi.fn(() => ({ from }));

  return {
    insert,
    update,
    returning,
    onConflictDoUpdate,
    select,
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

import { ingestYoutubeVideo } from "@/domain/ingest/ingest-youtube-video";

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
  return { getEnglishTranscript: impl };
}

describe("ingestYoutubeVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always fetches from provider and lands on analyzing", async () => {
    const getEnglishTranscript = vi.fn(async () => sampleTranscript);
    const provider = mockProvider(getEnglishTranscript);

    mocks.returning
      .mockResolvedValueOnce([{ id: "uv-1" }])
      .mockResolvedValueOnce([
        { id: "analysis-1", status: "fetching_transcript" },
      ]);

    const result = await ingestYoutubeVideo(
      { userId: "user-1", youtubeId: "dQw4w9WgXcQ" },
      { transcriptProvider: provider },
    );

    expect(getEnglishTranscript).toHaveBeenCalledTimes(1);
    expect(getEnglishTranscript).toHaveBeenCalledWith("dQw4w9WgXcQ");
    expect(result.status).toBe("analyzing");
    expect(result.userVideoId).toBe("uv-1");
    expect(mocks.update).toHaveBeenCalled();
  });

  it("calls provider again on re-paste (no shared cache skip)", async () => {
    const getEnglishTranscript = vi.fn(async () => sampleTranscript);
    const provider = mockProvider(getEnglishTranscript);

    mocks.returning
      .mockResolvedValueOnce([{ id: "uv-1" }])
      .mockResolvedValueOnce([
        { id: "analysis-1", status: "fetching_transcript" },
      ])
      .mockResolvedValueOnce([{ id: "uv-1" }])
      .mockResolvedValueOnce([
        { id: "analysis-1", status: "fetching_transcript" },
      ]);

    await ingestYoutubeVideo(
      { userId: "user-1", youtubeId: "dQw4w9WgXcQ" },
      { transcriptProvider: provider },
    );
    await ingestYoutubeVideo(
      { userId: "user-1", youtubeId: "dQw4w9WgXcQ" },
      { transcriptProvider: provider },
    );

    expect(getEnglishTranscript).toHaveBeenCalledTimes(2);
  });

  it("returns failed when English captions are missing but a row was written", async () => {
    const provider = mockProvider(async () => {
      throw new TranscriptProviderError(
        "missing_english_captions",
        "This video has no English captions",
        { metadata: sampleTranscript.metadata },
      );
    });

    mocks.returning
      .mockResolvedValueOnce([{ id: "uv-1" }])
      .mockResolvedValueOnce([{ id: "analysis-1" }]);

    const result = await ingestYoutubeVideo(
      { userId: "user-1", youtubeId: "dQw4w9WgXcQ" },
      { transcriptProvider: provider },
    );

    expect(result).toEqual({
      userVideoId: "uv-1",
      analysisId: "analysis-1",
      status: "failed",
    });
    expect(mocks.insert).toHaveBeenCalled();
  });

  it("does not create a row when metadata is unavailable", async () => {
    const provider = mockProvider(async () => {
      throw new TranscriptProviderError(
        "missing_english_captions",
        "This video has no English captions",
      );
    });

    await expect(
      ingestYoutubeVideo(
        { userId: "user-1", youtubeId: "dQw4w9WgXcQ" },
        { transcriptProvider: provider },
      ),
    ).rejects.toMatchObject({ code: "missing_english_captions" });

    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
