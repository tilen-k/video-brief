import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import type { ClassifyVideoOutput, GenerateSectionsOutput } from "@/domain/analysis/schemas";
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
    status: "classifying",
    runId: "run-1",
  })),
}));

const RUN_ID = "11111111-1111-4111-8111-111111111111";

const classifyOutput: ClassifyVideoOutput = {
  isEducational: true,
  confidence: "high",
  topic: "physics",
};

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

const classifyingRow = {
  userVideoId: "uv-1",
  youtubeId: "dQw4w9WgXcQ",
  title: "Sample",
  channelTitle: "Channel",
  durationSeconds: 120,
  youtubeCategoryId: "27",
  transcriptSegments: [{ startMs: 0, text: "Hello" }],
  analysisId: "an-1",
  status: "classifying" as const,
  errorCode: null,
  errorMessage: null,
  analysisUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
  classification: null,
  familiarity: 50,
  summaryLength: 50,
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
  classification: {
    isEducational: true,
    confidence: "high",
    topic: "physics",
  },
  familiarity: 50,
  summaryLength: 50,
  summary: null,
  runId: RUN_ID,
  sections: [],
};

function mockAi(options?: {
  classify?: AIProvider["classifyVideo"];
  generate?: AIProvider["generateSections"];
}): AIProvider {
  return {
    classifyVideo: vi.fn(options?.classify ?? (async () => classifyOutput)),
    generateSections: vi.fn(
      options?.generate ?? (async () => generateOutput),
    ),
  };
}

function mockDb(options: {
  load: Record<string, unknown> | null;
  snapshot?: typeof workspaceSnapshot;
  updateRows?: { id: string }[];
  profile?: {
    yearOfBirth: number | null;
    educationLevel: string | null;
    subjects: string[] | null;
    summaryStyle: string | null;
  };
}) {
  const returning = vi
    .fn()
    .mockResolvedValue(options.updateRows ?? [{ id: "an-1" }]);
  const set = vi.fn(() => ({
    where: vi.fn(() => ({ returning })),
  }));
  const update = vi.fn(() => ({ set }));

  const snapshot = options.snapshot ?? workspaceSnapshot;
  const profile = options.profile ?? {
    yearOfBirth: null,
    educationLevel: null,
    subjects: null,
    summaryStyle: null,
  };

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
      where: vi.fn(() => ({
        limit: vi.fn(async () => [profile]),
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

  it("moves classifying to generating and persists classification", async () => {
    const { db, set } = mockDb({ load: classifyingRow });
    const ai = mockAi();

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("generating");
    expect(ai.classifyVideo).toHaveBeenCalledTimes(1);
    expect(ai.generateSections).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "generating",
        errorCode: null,
        classification: expect.objectContaining({
          isEducational: true,
          topic: "physics",
        }),
      }),
    );
  });

  it("does not call the model when status is complete", async () => {
    const { db, update } = mockDb({
      load: { ...classifyingRow, status: "complete" },
      snapshot: { ...workspaceSnapshot, status: "complete" },
    });
    const ai = mockAi();

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("complete");
    expect(ai.classifyVideo).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("skips work when expectedRunId does not match", async () => {
    const { db, update } = mockDb({ load: classifyingRow });
    const ai = mockAi();

    await continueAnalysis("user-1", "uv-1", {
      db,
      ai,
      expectedRunId: "22222222-2222-4222-8222-222222222222",
    });

    expect(ai.classifyVideo).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("marks failed when the provider throws", async () => {
    const { db, set } = mockDb({
      load: classifyingRow,
      snapshot: { ...workspaceSnapshot, status: "failed" },
    });
    const ai = mockAi({
      classify: async () => {
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
      load: { ...classifyingRow, transcriptSegments: [] },
      snapshot: { ...workspaceSnapshot, status: "failed" },
    });
    const ai = mockAi();

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("failed");
    expect(ai.classifyVideo).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("throws when persist misses and the same run is still in flight", async () => {
    const { db } = mockDb({
      load: classifyingRow,
      updateRows: [],
      snapshot: { ...workspaceSnapshot, status: "classifying" },
    });
    const ai = mockAi();

    await expect(continueAnalysis("user-1", "uv-1", { db, ai })).rejects.toThrow(
      "analysis persist lost the race",
    );
    expect(ai.classifyVideo).toHaveBeenCalledTimes(1);
  });

  it("marks failed when generate throws", async () => {
    const { db, set } = mockDb({
      load: {
        ...classifyingRow,
        status: "generating",
        classification: {
          isEducational: true,
          confidence: "high",
          topic: "physics",
        },
      },
      snapshot: { ...workspaceSnapshot, status: "failed" },
    });
    const ai = mockAi({
      generate: async () => {
        throw new Error("boom");
      },
    });

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.status).toBe("failed");
    expect(ai.classifyVideo).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorCode: ANALYSIS_FAILED_CODE,
      }),
    );
  });

  it("keeps a high-confidence non-educational label and still generates", async () => {
    const { db, set } = mockDb({
      load: classifyingRow,
      snapshot: {
        ...workspaceSnapshot,
        classification: {
          isEducational: false,
          confidence: "high",
          topic: null,
        },
      },
    });
    const ai = mockAi({
      classify: async () => ({
        isEducational: false,
        confidence: "high",
      }),
    });

    const result = await continueAnalysis("user-1", "uv-1", { db, ai });

    expect(result?.classification?.isEducational).toBe(false);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "generating",
        classification: expect.objectContaining({ isEducational: false }),
      }),
    );
  });

  it("generates overview and section bodies from generating", async () => {
    const { db, set } = mockDb({
      load: {
        ...classifyingRow,
        status: "generating",
        classification: {
          isEducational: true,
          confidence: "high",
          topic: "physics",
        },
      },
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
    expect(ai.classifyVideo).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        sections: generateOutput.sections,
        summary: generateOutput.summary,
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
