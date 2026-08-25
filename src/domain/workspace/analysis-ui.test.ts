import { describe, expect, it } from "vitest";

import {
  analysisChecklist,
  analysisUiPhase,
  isFailedStatus,
  paneKind,
  shouldPoll,
} from "./analysis-ui";
import { ANALYSIS_STATUSES } from "@/db/schema";

describe("analysisUiPhase", () => {
  it("maps every analysis status", () => {
    const expected: Record<(typeof ANALYSIS_STATUSES)[number], string> = {
      pending: "fetching",
      fetching: "fetching",
      generating: "generating",
      complete: "complete",
      failed: "failed",
    };
    for (const status of ANALYSIS_STATUSES) {
      expect(analysisUiPhase(status)).toBe(expected[status]);
    }
  });
});

describe("paneKind", () => {
  it("maps progress, complete, and failed", () => {
    expect(paneKind("pending")).toBe("progress");
    expect(paneKind("fetching")).toBe("progress");
    expect(paneKind("generating")).toBe("progress");
    expect(paneKind("complete")).toBe("complete");
    expect(paneKind("failed")).toBe("failed");
  });
});

describe("shouldPoll / isFailedStatus", () => {
  it("polls in-flight statuses only", () => {
    expect(shouldPoll("pending")).toBe(true);
    expect(shouldPoll("fetching")).toBe(true);
    expect(shouldPoll("generating")).toBe(true);
    expect(shouldPoll("complete")).toBe(false);
    expect(shouldPoll("failed")).toBe(false);
  });

  it("detects failed", () => {
    expect(isFailedStatus("failed")).toBe(true);
    expect(isFailedStatus("generating")).toBe(false);
  });
});

describe("analysisChecklist", () => {
  it("marks transcript as current while fetching", () => {
    expect(analysisChecklist("fetching")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "current" },
      { id: "summary", state: "upcoming" },
    ]);
  });

  it("marks summary as current while generating", () => {
    expect(analysisChecklist("generating")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "done" },
      { id: "summary", state: "current" },
    ]);
  });

  it("marks all done when complete", () => {
    expect(analysisChecklist("complete")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "done" },
      { id: "summary", state: "done" },
    ]);
  });
});
