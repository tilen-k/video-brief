import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";

import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";

import { submitVideoPrefs } from "./submit-video-prefs";

const awaitingRow = {
  analysisId: "an-1",
  status: "awaiting" as const,
};

const snapshot: WorkspaceVideo = {
  userVideoId: "uv-1",
  youtubeId: "dQw4w9WgXcQ",
  title: "Sample",
  channelTitle: "Channel",
  status: "generating" as const,
  errorCode: null,
  errorMessage: null,
  classification: {
    isEducational: true,
    confidence: "high" as const,
    topic: "physics",
  },
  familiarity: "somewhat" as const,
  summaryLength: "brief" as const,
  defaultLength: "moderate" as const,
  askFamiliarity: true,
  askLength: true,
  sections: [],
};

function mockDb(options: {
  load: { status: string; analysisId: string } | null;
  snapshot?: typeof snapshot;
  updateRows?: { id: string }[];
}) {
  const returning = vi
    .fn()
    .mockResolvedValue(options.updateRows ?? [{ id: "an-1" }]);
  const set = vi.fn(() => ({
    where: vi.fn(() => ({ returning })),
  }));
  const update = vi.fn(() => ({ set }));

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [options.snapshot ?? snapshot]),
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
    set,
    update,
  };
}

describe("submitVideoPrefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes prefs and lands on generating", async () => {
    const { db, set } = mockDb({ load: awaitingRow });

    const result = await submitVideoPrefs(
      "user-1",
      "uv-1",
      { familiarity: "somewhat", summaryLength: "brief" },
      { db },
    );

    expect(result?.status).toBe("generating");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "generating",
        familiarity: "somewhat",
        summaryLength: "brief",
      }),
    );
  });

  it("allows empty submit without overwriting prefs", async () => {
    const { db, set } = mockDb({ load: awaitingRow });

    await submitVideoPrefs("user-1", "uv-1", {}, { db });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "generating",
      }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.not.objectContaining({
        familiarity: expect.anything(),
      }),
    );
  });

  it("is a no-op when status is not awaiting", async () => {
    const { db, update } = mockDb({
      load: { analysisId: "an-1", status: "complete" },
      snapshot: { ...snapshot, status: "complete" },
    });

    const result = await submitVideoPrefs(
      "user-1",
      "uv-1",
      { familiarity: "very" },
      { db },
    );

    expect(result?.status).toBe("complete");
    expect(update).not.toHaveBeenCalled();
  });

  it("returns null when the row is missing", async () => {
    const { db } = mockDb({ load: null });
    const result = await submitVideoPrefs("user-1", "uv-missing", {}, { db });
    expect(result).toBeNull();
  });
});
