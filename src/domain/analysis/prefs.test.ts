import { describe, expect, it } from "vitest";

import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
  clampPrefScore,
} from "./prefs";

describe("pref defaults", () => {
  it("exposes 50 as the default length and tone", () => {
    expect(DEFAULT_LENGTH_SCORE).toBe(50);
    expect(DEFAULT_TONE_SCORE).toBe(50);
  });
});

describe("clampPrefScore", () => {
  it("rounds and clamps to 0–100", () => {
    expect(clampPrefScore(-4)).toBe(0);
    expect(clampPrefScore(101.2)).toBe(100);
    expect(clampPrefScore(49.6)).toBe(50);
  });
});
