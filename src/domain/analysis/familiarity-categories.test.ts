import { describe, expect, it } from "vitest";

import { showFamiliaritySlider } from "./familiarity-categories";

describe("showFamiliaritySlider", () => {
  it("accepts canonical YouTube category ids", () => {
    expect(showFamiliaritySlider("27")).toBe(true);
    expect(showFamiliaritySlider("26")).toBe(true);
    expect(showFamiliaritySlider("28")).toBe(true);
    expect(showFamiliaritySlider("25")).toBe(true);
  });

  it("accepts English category labels (case-insensitive)", () => {
    expect(showFamiliaritySlider("Education")).toBe(true);
    expect(showFamiliaritySlider("howto & style")).toBe(true);
    expect(showFamiliaritySlider("Science & Technology")).toBe(true);
    expect(showFamiliaritySlider("News & Politics")).toBe(true);
  });

  it("rejects null, empty, and unknown categories", () => {
    expect(showFamiliaritySlider(null)).toBe(false);
    expect(showFamiliaritySlider(undefined)).toBe(false);
    expect(showFamiliaritySlider("")).toBe(false);
    expect(showFamiliaritySlider("  ")).toBe(false);
    expect(showFamiliaritySlider("22")).toBe(false);
    expect(showFamiliaritySlider("Music")).toBe(false);
  });
});
