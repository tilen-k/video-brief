import { describe, expect, it } from "vitest";

import type { ClassifyVideoOutput } from "./schemas";
import { clampSectionTimes, preferEducational } from "./prefer-educational";

const base: ClassifyVideoOutput = {
  isEducational: false,
  confidence: "high",
  topic: "math",
};

describe("preferEducational", () => {
  it("forces educational when confidence is low", () => {
    const result = preferEducational({
      ...base,
      isEducational: false,
      confidence: "low",
    });
    expect(result.isEducational).toBe(true);
  });

  it("leaves a high-confidence non-educational label unchanged", () => {
    expect(preferEducational(base).isEducational).toBe(false);
  });
});

describe("clampSectionTimes", () => {
  it("clamps times into [0, duration]", () => {
    expect(
      clampSectionTimes(
        [
          { title: "A", startTime: -5, endTime: 999, body: "a" },
          { title: "B", startTime: 80, endTime: 40, body: "b" },
        ],
        60,
      ),
    ).toEqual([
      { title: "A", startTime: 0, endTime: 60, body: "a" },
      { title: "B", startTime: 60, endTime: 60, body: "b" },
    ]);
  });
});
