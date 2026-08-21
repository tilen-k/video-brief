import { describe, expect, it } from "vitest";

import {
  onboardingInputSchema,
  onboardingToContextEntries,
} from "./onboarding";

describe("onboardingInputSchema", () => {
  it("accepts empty onboarding (skip)", () => {
    const result = onboardingInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts filled fields", () => {
    const result = onboardingInputSchema.safeParse({
      role: "Frontend developer",
      background: "I work on React apps",
      interests: "AI, distributed systems",
      summaryStyle: "structured",
      detailLevel: "balanced",
    });
    expect(result.success).toBe(true);
  });

  it("treats empty strings as omitted", () => {
    const result = onboardingInputSchema.safeParse({
      role: "",
      summaryStyle: "",
      detailLevel: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBeUndefined();
      expect(result.data.summaryStyle).toBeUndefined();
      expect(result.data.detailLevel).toBeUndefined();
    }
  });

  it("rejects invalid summaryStyle", () => {
    const result = onboardingInputSchema.safeParse({
      summaryStyle: "poetry",
    });
    expect(result.success).toBe(false);
  });
});

describe("onboardingToContextEntries", () => {
  it("omits empty values", () => {
    const parsed = onboardingInputSchema.parse({
      role: "  Dev  ",
      background: "",
      interests: "   ",
      summaryStyle: "concise",
      detailLevel: "",
    });
    expect(onboardingToContextEntries(parsed)).toEqual([
      { key: "role", value: "Dev" },
      { key: "summary_style", value: "concise" },
    ]);
  });

  it("returns no entries for full skip", () => {
    expect(onboardingToContextEntries({})).toEqual([]);
  });
});
