import { describe, expect, it } from "vitest";

import { repairClassifyText } from "./repair-classify-text";

describe("repairClassifyText", () => {
  it("parses valid JSON", () => {
    expect(
      repairClassifyText(
        '{"isEducational":true,"confidence":"high","topic":"calculus"}',
      ),
    ).toEqual({
      isEducational: true,
      confidence: "high",
      topic: "calculus",
    });
  });

  it("parses JSON wrapped in a markdown fence", () => {
    expect(
      repairClassifyText(
        '```json\n{"isEducational":false,"confidence":"medium"}\n```',
      ),
    ).toEqual({
      isEducational: false,
      confidence: "medium",
    });
  });

  it("parses comma-separated values from weak JSON models", () => {
    expect(
      repairClassifyText(
        "true, high, police interrogation rights and self-incrimination.",
      ),
    ).toEqual({
      isEducational: true,
      confidence: "high",
      topic: "police interrogation rights and self-incrimination",
    });
  });

  it("returns null for unrelated prose", () => {
    expect(repairClassifyText("I think this is educational.")).toBeNull();
  });
});
