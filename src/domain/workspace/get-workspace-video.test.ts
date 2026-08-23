import { inspect } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";

import { getWorkspaceVideo } from "./get-workspace-video";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const leftJoin = vi.fn(() => ({ where }));
  const innerJoin = vi.fn(() => ({ leftJoin }));
  const from = vi.fn(() => ({ innerJoin }));
  const select = vi.fn(() => ({ from }));
  return { limit, where, leftJoin, innerJoin, from, select };
});

function mockDb(): Db {
  return { select: mocks.select } as unknown as Db;
}

const ownedRow = {
  userVideoId: "uv-1",
  youtubeId: "dQw4w9WgXcQ",
  title: "Sample",
  channelTitle: "Channel",
  status: "classifying",
  errorCode: null,
  errorMessage: null,
  classification: {
    isEducational: true,
    confidence: "high",
    topic: "physics",
  },
  familiarity: null,
  summaryLength: null,
  sections: [],
  summaryStyle: null,
};

describe("getWorkspaceVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the owned row with prefs flags", async () => {
    mocks.limit.mockResolvedValueOnce([ownedRow]);

    const result = await getWorkspaceVideo("user-1", "uv-1", { db: mockDb() });

    expect(result).toEqual({
      userVideoId: "uv-1",
      youtubeId: "dQw4w9WgXcQ",
      title: "Sample",
      channelTitle: "Channel",
      status: "classifying",
      errorCode: null,
      errorMessage: null,
      classification: ownedRow.classification,
      familiarity: null,
      summaryLength: null,
      defaultLength: "moderate",
      askFamiliarity: true,
      askLength: true,
      sections: [],
    });
    expect(mocks.select).toHaveBeenCalled();
  });

  it("returns null when the row is missing or not owned", async () => {
    mocks.limit.mockResolvedValueOnce([]);

    const result = await getWorkspaceVideo("user-1", "uv-missing", {
      db: mockDb(),
    });

    expect(result).toBeNull();
  });

  it("scopes the query to the session user and video id", async () => {
    mocks.limit.mockResolvedValueOnce([]);

    await getWorkspaceVideo("owner-user", "video-row", { db: mockDb() });

    expect(mocks.where).toHaveBeenCalledTimes(1);
    expect(mocks.innerJoin).toHaveBeenCalledTimes(1);
    expect(mocks.leftJoin).toHaveBeenCalledTimes(1);

    const joinCalls = mocks.leftJoin.mock.calls as unknown[][];
    const whereCalls = mocks.where.mock.calls as unknown[][];
    const blob = inspect(
      { joinOn: joinCalls[0]?.[1], where: whereCalls[0]?.[0] },
      { depth: 8, maxArrayLength: 50 },
    );

    expect(blob).toContain("owner-user");
    expect(blob).toContain("video-row");
  });

  it("treats a missing analysis row as pending", async () => {
    mocks.limit.mockResolvedValueOnce([
      {
        ...ownedRow,
        status: null,
        classification: null,
        sections: null,
      },
    ]);

    const result = await getWorkspaceVideo("user-1", "uv-1", { db: mockDb() });

    expect(result?.status).toBe("pending");
    expect(result?.askFamiliarity).toBe(false);
  });
});
