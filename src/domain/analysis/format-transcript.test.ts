import { describe, expect, it } from "vitest";

import type { TranscriptSegment } from "@/db/schema";
import { UsageError } from "@/domain/usage/errors";

import { analysisConfig } from "./config";
import {
  assertTranscriptWithinBudget,
  formatTranscript,
  formatTranscriptLine,
} from "./format-transcript";

function segment(startMs: number, text: string): TranscriptSegment {
  return { startMs, text };
}

describe("formatTranscript", () => {
  it("returns every line as [seconds] text", () => {
    const segments = [segment(0, "Hello"), segment(1500, "World")];
    expect(formatTranscript(segments)).toBe(
      `${formatTranscriptLine(segments[0]!)}\n${formatTranscriptLine(segments[1]!)}`,
    );
    expect(formatTranscript(segments)).toContain("[0]");
    expect(formatTranscript(segments)).toContain("[1]");
  });
});

describe("assertTranscriptWithinBudget", () => {
  it("allows transcripts at the tier budget", () => {
    const formatted = "x".repeat(analysisConfig.modelTiers.basic.transcriptCharBudget);
    expect(() => assertTranscriptWithinBudget(formatted, "basic")).not.toThrow();
  });

  it("rejects transcripts over the basic budget", () => {
    const formatted = "x".repeat(
      analysisConfig.modelTiers.basic.transcriptCharBudget + 1,
    );
    expect(() => assertTranscriptWithinBudget(formatted, "basic")).toThrow(
      UsageError,
    );
    try {
      assertTranscriptWithinBudget(formatted, "basic");
    } catch (error) {
      expect(error).toMatchObject({ code: "transcript_too_large", tier: "basic" });
    }
  });

  it("allows a basic-oversize dump on advanced", () => {
    const formatted = "x".repeat(
      analysisConfig.modelTiers.basic.transcriptCharBudget + 1,
    );
    expect(() =>
      assertTranscriptWithinBudget(formatted, "advanced"),
    ).not.toThrow();
  });
});
