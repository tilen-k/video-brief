import { describe, expect, it } from "vitest";

import { buildGeneratePrompt } from "@/lib/ai/openrouter-ai-provider";
import type { GenerateSectionsInput } from "@/lib/ai/provider";

const base: GenerateSectionsInput = {
  title: "Lecture",
  channelTitle: "Channel",
  durationSeconds: 60,
  transcriptSubset: "hello",
  prefs: {
    familiarity: 20,
    summaryLength: 80,
    summaryTone: 30,
  },
};

describe("buildGeneratePrompt", () => {
  it("includes familiarity, length, and tone when familiarity is set", () => {
    const prompt = buildGeneratePrompt(base);
    expect(prompt).toContain("Familiarity with topic (0–100, Novice←→Expert): 20");
    expect(prompt).toContain("Requested length (0–100, Short←→Long): 80");
    expect(prompt).toContain("Requested tone (0–100, Formal←→Casual): 30");
  });

  it("omits familiarity when null", () => {
    const prompt = buildGeneratePrompt({
      ...base,
      prefs: {
        ...base.prefs,
        familiarity: null,
      },
    });
    expect(prompt).not.toContain("Familiarity with topic");
    expect(prompt).toContain("Requested length (0–100, Short←→Long): 80");
    expect(prompt).toContain("Requested tone (0–100, Formal←→Casual): 30");
  });
});
