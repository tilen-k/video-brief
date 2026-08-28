import { describe, expect, it } from "vitest";

import {
  buildGeneratePrompt,
  GENERATE_SYSTEM,
  summaryParagraphCount,
} from "@/lib/ai/openrouter-ai-provider";
import type { GenerateSectionsInput } from "@/lib/ai/provider";

const baseInput: GenerateSectionsInput = {
  title: "Sample",
  channelTitle: "Channel",
  durationSeconds: 120,
  transcriptSubset: "Hello world",
  outputLanguage: "de",
  transcriptLanguage: "en",
  prefs: {
    familiarity: 50,
    summaryLength: 50,
    summaryTone: 50,
  },
};

describe("buildGeneratePrompt", () => {
  it("includes output and transcript language lines", () => {
    const prompt = buildGeneratePrompt(baseInput);
    expect(prompt).toContain("Output language: German (de)");
    expect(prompt).toContain("Transcript language: English (en)");
    expect(prompt).toContain("translate while staying faithful");
  });

  it("omits translation note when languages match", () => {
    const prompt = buildGeneratePrompt({
      ...baseInput,
      transcriptLanguage: "de",
    });
    expect(prompt).not.toContain("translate while staying faithful");
  });

  it("instructs synthesis instead of verbatim transcript quoting", () => {
    expect(GENERATE_SYSTEM).toContain("Do not quote the transcript verbatim");
    expect(GENERATE_SYSTEM).toContain("interviews, debates, or Q&A");
  });

  it("requests more paragraphs when summary length is higher", () => {
    expect(summaryParagraphCount(20)).toBe(2);
    expect(summaryParagraphCount(55)).toBe(3);
    expect(summaryParagraphCount(90)).toBe(4);
    expect(buildGeneratePrompt(base)).toContain(
      "Write the summary as 4 short paragraphs",
    );
    expect(
      buildGeneratePrompt({
        ...base,
        prefs: { ...base.prefs, summaryLength: 30 },
      }),
    ).toContain("Write the summary as 2 short paragraphs");
  });
});
