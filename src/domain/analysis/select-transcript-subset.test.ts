import { describe, expect, it } from "vitest";

import type { TranscriptSegment } from "@/db/schema";

import { analysisConfig } from "./config";
import {
  formatTranscriptLine,
  selectTranscriptSubset,
} from "./select-transcript-subset";

function segment(startMs: number, text: string): TranscriptSegment {
  return { startMs, text };
}

describe("selectTranscriptSubset", () => {
  it("returns every line when the transcript is under budget", () => {
    const segments = [segment(0, "Hello"), segment(1500, "World")];
    const result = selectTranscriptSubset(segments, 10);
    expect(result).toBe(
      `${formatTranscriptLine(segments[0]!)}\n${formatTranscriptLine(segments[1]!)}`,
    );
    expect(result).toContain("[0]");
    expect(result).toContain("[1]");
  });

  it("keeps first 3 minutes and last minute on a long transcript", () => {
    const segments: TranscriptSegment[] = [];
    for (let i = 0; i < 400; i++) {
      segments.push(
        segment(i * 15_000, `Caption number ${i} ${"x".repeat(80)}`),
      );
    }

    const result = selectTranscriptSubset(segments, 6000);
    expect(result.length).toBeLessThanOrEqual(
      analysisConfig.transcript.charBudget,
    );
    expect(result).toContain("[0]");
    expect(result).toContain("[30]");
    expect(result).toMatch(/\[59[0-9]{2}\]/);
  });
});
