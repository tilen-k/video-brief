import { describe, expect, it } from "vitest";

import { onboardingInputSchema } from "./onboarding";
import {
  generateVideoInputSchema,
  previewYoutubeInputSchema,
} from "./library";

describe("onboardingInputSchema", () => {
  it("accepts tone and length", () => {
    const result = onboardingInputSchema.safeParse({
      summaryTone: 25,
      summaryLength: 75,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summaryTone).toBe(25);
      expect(result.data.summaryLength).toBe(75);
    }
  });

  it("treats empty skip payload as valid", () => {
    const result = onboardingInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("coerces form strings", () => {
    const result = onboardingInputSchema.safeParse({
      summaryTone: "40",
      summaryLength: "60",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summaryTone).toBe(40);
      expect(result.data.summaryLength).toBe(60);
    }
  });

  it("rejects out-of-range scores", () => {
    expect(
      onboardingInputSchema.safeParse({ summaryTone: 101 }).success,
    ).toBe(false);
  });
});

describe("previewYoutubeInputSchema", () => {
  it("returns youtubeId for valid URLs", () => {
    const result = previewYoutubeInputSchema.safeParse({
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.youtubeId).toBe("dQw4w9WgXcQ");
    }
  });
});

describe("generateVideoInputSchema", () => {
  it("keeps familiarity for the action to gate via server metadata", () => {
    const result = generateVideoInputSchema.safeParse({
      youtubeId: "dQw4w9WgXcQ",
      summaryLength: "50",
      summaryTone: "50",
      familiarity: "80",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.familiarity).toBe(80);
    }
  });

  it("allows null familiarity", () => {
    const result = generateVideoInputSchema.safeParse({
      youtubeId: "dQw4w9WgXcQ",
      summaryLength: "50",
      summaryTone: "40",
      familiarity: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.familiarity).toBeNull();
    }
  });
});
