import { describe, expect, it } from "vitest";

import {
  classifyVideoSchema,
  generateSectionsSchema,
} from "./schemas";

describe("classifyVideoSchema", () => {
  it("accepts educational output with a topic", () => {
    const result = classifyVideoSchema.parse({
      isEducational: true,
      confidence: "high",
      topic: "linear algebra",
    });
    expect(result.topic).toBe("linear algebra");
  });

  it("accepts missing topic", () => {
    expect(
      classifyVideoSchema.parse({
        isEducational: false,
        confidence: "medium",
      }).topic,
    ).toBeUndefined();
  });

  it("strips unknown classify fields", () => {
    const result = classifyVideoSchema.safeParse({
      isEducational: true,
      confidence: "high",
      domains: ["math"],
    });
    expect(result.success).toBe(true);
  });
});

describe("generateSectionsSchema", () => {
  it("requires at least one section with a body", () => {
    expect(
      generateSectionsSchema.safeParse({ sections: [] }).success,
    ).toBe(false);
    expect(
      generateSectionsSchema.parse({
        summary: "A short overview.",
        sections: [
          {
            title: "Intro",
            startTime: 0,
            endTime: 12,
            body: "A short framing of the opening.",
          },
        ],
      }).sections,
    ).toHaveLength(1);
  });

  it("requires a summary", () => {
    expect(
      generateSectionsSchema.safeParse({
        sections: [
          {
            title: "Intro",
            startTime: 0,
            endTime: 12,
            body: "Body",
          },
        ],
      }).success,
    ).toBe(false);
  });
});
