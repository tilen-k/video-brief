import { describe, expect, it } from "vitest";

import { ANALYSIS_STATUSES, type AnalysisStatus } from "@/db/schema";

import { analysisUiPhase, isFailedStatus } from "./analysis-ui";

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

describe("isFailedStatus", () => {
  it("returns true only for failed", () => {
    expect(isFailedStatus("failed")).toBe(true);
    expect(isFailedStatus("complete")).toBe(false);
    expect(isFailedStatus("analyzing")).toBe(false);
  });
});
