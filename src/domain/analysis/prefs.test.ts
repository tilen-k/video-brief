import { describe, expect, it } from "vitest";

import {
  DEFAULT_LENGTH_SCORE,
  clampPrefScore,
  defaultLengthScore,
} from "./prefs";

describe("defaultLengthScore", () => {
  it("maps profile summary style to a 0–100 length default", () => {
    expect(defaultLengthScore("brief")).toBe(25);
    expect(defaultLengthScore("moderate")).toBe(50);
    expect(defaultLengthScore("extensive")).toBe(75);
    expect(defaultLengthScore(null)).toBe(DEFAULT_LENGTH_SCORE);
    expect(defaultLengthScore(undefined)).toBe(DEFAULT_LENGTH_SCORE);
  });
});

describe("clampPrefScore", () => {
  it("rounds and clamps to 0–100", () => {
    expect(clampPrefScore(-4)).toBe(0);
    expect(clampPrefScore(101.2)).toBe(100);
    expect(clampPrefScore(49.6)).toBe(50);
  });
});
