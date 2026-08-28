import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import type { GenerateSectionsOutput } from "@/domain/analysis/schemas";
import type { AIProvider } from "@/lib/ai/provider";

import {
  ANALYSIS_FAILED_CODE,
  continueAnalysis,
  timestampToEpochMs,
} from "./continue-analysis";

vi.mock("@/domain/ingest/ingest-youtube-video", () => ({
  fetchYoutubeVideo: vi.fn(async () => ({
    userVideoId: "uv-1",
    analysisId: "an-1",
    status: "generating",
    runId: "run-1",
  })),
}));

vi.mock("@/domain/usage/plan", () => ({
  getPlanForUser: vi.fn(async () => "free" as const),
}));

const RUN_ID = "11111111-1111-4111-8111-111111111111";

const generateOutput: GenerateSectionsOutput = {
  summary: "A short overview of the lecture.",
  sections: [
    {
      title: "Intro",
      startTime: 0,
      endTime: 30,
      body: "Opening framing.",
    },
  ],
};

const generatingRow = {
  userVideoId: "uv-1",
  youtubeId: "dQw4w9WgXcQ",
  title: "Sample",
  channelTitle: "Channel",
  durationSeconds: 120,
  youtubeCategoryId: "27",
  transcriptSegments: [{ startMs: 0, text: "Hello" }],
  transcriptLanguage: "en",
  analysisId: "an-1",
  status: "generating" as const,
  errorCode: null,
  errorMessage: null,
  analysisUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
  familiarity: 50,
  summaryLength: 50,
  summaryTone: 50,
  modelTier: "basic" as const,
  summaryLanguage: "de",
  runId: RUN_ID,
};

const workspaceSnapshot: WorkspaceVideo = {
  userVideoId: "uv-1",
  youtubeId: "dQw4w9WgXcQ",
  title: "Sample",
  channelTitle: "Channel",
  status: "generating",
  errorCode: null,
  errorMessage: null,
  familiarity: 50,
  summaryLength: 50,
  summaryTone: 50,
  summary: null,
  runId: RUN_ID,
  sections: [],
};

function mockAi(options?: {
  generate?: AIProvider["generateSections"];
}): AIProvider {
  return {
    generateSections: vi.fn(
      options?.generate ?? (async () => generateOutput),
    ),
  };
}

function mockDb(options: {
  load: Record<string, unknown> | null;
  snapshot?: typeof workspaceSnapshot;
  updateRows?: { id: string }[];
}) {
  const returning = vi
    .fn()
    .mockResolvedValue(options.updateRows ?? [{ id: "an-1" }]);
  const set = vi.fn(() => ({
    where: vi.fn(() => ({ returning })),
  }));
  const update = vi.fn(() => ({ set }));

  const snapshot = options.snapshot ?? workspaceSnapshot;

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [snapshot]),
          })),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(async () => (options.load ? [options.load] : [])),
        })),
      })),
    })),
  }));

  return {
    db: { select, update } as unknown as Db,
    returning,
    set,
    update,
  };
}

describe("continueAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call the model when status is complete", async () => {
    const { db, update } = mockDb({
      load: { ...generatingRow, status: "complete" },
      snapshot: { ...workspaceSnapshot, status: "complete" },
    });
    const ai = mockAi();

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("complete");
    expect(ai.generateSections).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("skips work when expectedRunId does not match", async () => {
    const { db, update } = mockDb({ load: generatingRow });
    const ai = mockAi();

    await continueAnalysis("user-1", "uv-1", {
      db,
      ai,
      expectedRunId: "22222222-2222-4222-8222-222222222222",
    });

    expect(ai.generateSections).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("marks failed when generate throws", async () => {
    const { db, set } = mockDb({
      load: generatingRow,
      snapshot: { ...workspaceSnapshot, status: "failed" },
    });
    const ai = mockAi({
      generate: async () => {
        throw new Error("boom");
      },
    });

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("failed");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorCode: ANALYSIS_FAILED_CODE,
      }),
    );
  });

  it("marks failed when the transcript is empty", async () => {
    const { db, set } = mockDb({
      load: { ...generatingRow, transcriptSegments: [] },
      snapshot: { ...workspaceSnapshot, status: "failed" },
    });
    const ai = mockAi();

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("failed");
    expect(ai.generateSections).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("throws when persist misses and the same run is still in flight", async () => {
    const { db } = mockDb({
      load: generatingRow,
      updateRows: [],
      snapshot: { ...workspaceSnapshot, status: "generating" },
    });
    const ai = mockAi();

    await expect(continueAnalysis("user-1", "uv-1", { db, ai })).rejects.toThrow(
      "analysis persist lost the race",
    );
    expect(ai.generateSections).toHaveBeenCalledTimes(1);
  });

  it("generates overview and section bodies from generating", async () => {
    const { db, set } = mockDb({
      load: generatingRow,
      snapshot: {
        ...workspaceSnapshot,
        status: "complete",
        summary: generateOutput.summary,
        sections: generateOutput.sections,
      },
    });
    const ai = mockAi();

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("complete");
    expect(ai.generateSections).toHaveBeenCalledTimes(1);
    expect(ai.generateSections).toHaveBeenCalledWith(
      expect.objectContaining({
        outputLanguage: "de",
        transcriptLanguage: "en",
        prefs: expect.objectContaining({
          familiarity: 50,
          summaryLength: 50,
          summaryTone: 50,
        }),
      }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        sections: [{ ...generateOutput.sections[0], endTime: 120 }],
        summary: generateOutput.summary,
      }),
    );
  });

  it("passes null familiarity through to generate", async () => {
    const { db } = mockDb({
      load: { ...generatingRow, familiarity: null },
      snapshot: {
        ...workspaceSnapshot,
        status: "complete",
        familiarity: null,
        summary: generateOutput.summary,
        sections: generateOutput.sections,
      },
    });
    const ai = mockAi();

    await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(ai.generateSections).toHaveBeenCalledWith(
      expect.objectContaining({
        prefs: expect.objectContaining({ familiarity: null }),
      }),
    );
  });
});

describe("timestampToEpochMs", () => {
  it("parses Date and ISO strings to the same millisecond", () => {
    const iso = "2026-01-01T00:00:00.000Z";
    expect(timestampToEpochMs(new Date(iso))).toBe(Date.parse(iso));
    expect(timestampToEpochMs(iso)).toBe(Date.parse(iso));
  });
});
