import { describe, expect, it } from "vitest";

import { buildGeneratePrompt } from "@/lib/ai/openrouter-ai-provider";
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
});
