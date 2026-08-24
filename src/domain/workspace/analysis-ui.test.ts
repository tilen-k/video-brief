import { describe, expect, it } from "vitest";

import type { AnalysisStatus } from "@/db/schema";
import { ANALYSIS_STATUSES } from "@/db/schema";

import {
  analysisChecklist,
  analysisUiPhase,
  isFailedStatus,
  paneKind,
  shouldPoll,
} from "./analysis-ui";

const IN_FLIGHT: AnalysisStatus[] = [
  "pending",
  "fetching",
  "classifying",
  "generating",
];

const STOP_POLL: AnalysisStatus[] = ["complete", "failed"];

describe("analysisUiPhase", () => {
  it("maps every analysis status to a user-facing phase", () => {
    const expected: Record<AnalysisStatus, string> = {
      pending: "fetching",
      fetching: "fetching",
      classifying: "understanding",
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
  it("shows progress while work is in flight", () => {
    expect(paneKind("pending")).toBe("progress");
    expect(paneKind("fetching")).toBe("progress");
    expect(paneKind("classifying")).toBe("progress");
    expect(paneKind("generating")).toBe("progress");
  });

  it("selects terminal panes without leaking machine names", () => {
    expect(paneKind("failed")).toBe("failed");
    expect(paneKind("complete")).toBe("complete");
  });
});

describe("shouldPoll", () => {
  it("polls in-flight statuses only", () => {
    for (const status of IN_FLIGHT) {
      expect(shouldPoll(status)).toBe(true);
    }
    for (const status of STOP_POLL) {
      expect(shouldPoll(status)).toBe(false);
    }
  });
});

describe("isFailedStatus", () => {
  it("returns true only for failed", () => {
    expect(isFailedStatus("failed")).toBe(true);
    expect(isFailedStatus("complete")).toBe(false);
    expect(isFailedStatus("classifying")).toBe(false);
  });
});

describe("analysisChecklist", () => {
  it("marks transcript as current while captions load", () => {
    expect(analysisChecklist("fetching")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "current" },
      { id: "understanding", state: "upcoming" },
      { id: "summary", state: "upcoming" },
    ]);
  });

  it("marks understanding as current while classifying", () => {
    expect(analysisChecklist("classifying")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "done" },
      { id: "understanding", state: "current" },
      { id: "summary", state: "upcoming" },
    ]);
  });

  it("marks summary as current while generating", () => {
    expect(analysisChecklist("generating")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "done" },
      { id: "understanding", state: "done" },
      { id: "summary", state: "current" },
    ]);
  });
});
