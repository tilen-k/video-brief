import { describe, expect, it } from "vitest";

import type { AnalysisStatus } from "@/db/schema";
import { ANALYSIS_STATUSES } from "@/db/schema";

import {
  analysisChecklist,
  analysisUiPhase,
  paneKind,
  shouldPoll,
} from "./analysis-ui";

const IN_FLIGHT: AnalysisStatus[] = [
  "pending",
  "fetching_transcript",
  "analyzing",
  "generating_summary",
];

const STOP_POLL: AnalysisStatus[] = [
  "complete",
  "failed",
  "awaiting_context",
];

describe("analysisUiPhase", () => {
  it("maps every analysis status to a user-facing phase", () => {
    const expected: Record<AnalysisStatus, string> = {
      pending: "fetching",
      fetching_transcript: "fetching",
      analyzing: "understanding",
      generating_summary: "generating",
      awaiting_context: "awaiting",
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
    expect(paneKind("fetching_transcript")).toBe("progress");
    expect(paneKind("analyzing")).toBe("progress");
    expect(paneKind("generating_summary")).toBe("progress");
  });

  it("selects terminal panes without leaking machine names", () => {
    expect(paneKind("failed")).toBe("failed");
    expect(paneKind("awaiting_context")).toBe("awaiting");
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

describe("analysisChecklist", () => {
  it("marks transcript as current while captions load", () => {
    expect(analysisChecklist("fetching_transcript")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "current" },
      { id: "understanding", state: "upcoming" },
      { id: "summary", state: "upcoming" },
    ]);
  });

  it("marks understanding as current after ingest lands on analyzing", () => {
    expect(analysisChecklist("analyzing")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "done" },
      { id: "understanding", state: "current" },
      { id: "summary", state: "upcoming" },
    ]);
  });

  it("marks summary as current while generating", () => {
    expect(analysisChecklist("generating_summary")).toEqual([
      { id: "found", state: "done" },
      { id: "transcript", state: "done" },
      { id: "understanding", state: "done" },
      { id: "summary", state: "current" },
    ]);
  });
});
