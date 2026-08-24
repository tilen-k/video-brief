import { describe, expect, it } from "vitest";

import { buildGeneratePrompt } from "@/lib/ai/openrouter-ai-provider";
import type { GenerateSectionsInput } from "@/lib/ai/provider";

const base: GenerateSectionsInput = {
  title: "Lecture",
  channelTitle: "Channel",
  durationSeconds: 60,
  transcriptSubset: "hello",
  classification: {
    isEducational: true,
    confidence: "high",
    topic: "physics",
  },
  profile: {
    yearOfBirth: 2000,
    educationLevel: "undergrad",
    subjects: ["physics"],
    summaryStyle: "moderate",
  },
  prefs: {
    familiarity: 20,
    summaryLength: 80,
  },
};

describe("buildGeneratePrompt", () => {
  it("includes familiarity for educational videos", () => {
    const prompt = buildGeneratePrompt(base);
    expect(prompt).toContain("Familiarity with topic (0–100): 20");
    expect(prompt).toContain("Requested length (0–100): 80");
  });

  it("omits familiarity for non-educational videos", () => {
    const prompt = buildGeneratePrompt({
      ...base,
      classification: {
        isEducational: false,
        confidence: "high",
        topic: null,
      },
    });
    expect(prompt).not.toContain("Familiarity with topic");
    expect(prompt).toContain("Requested length (0–100): 80");
  });
});
