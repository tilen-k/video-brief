import { describe, expect, it } from "vitest";

import {
  onboardingInputSchema,
} from "./onboarding";

describe("onboardingInputSchema", () => {
  it("accepts empty onboarding (skip)", () => {
    const result = onboardingInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts filled educational fields", () => {
    const result = onboardingInputSchema.safeParse({
      yearOfBirth: 2003,
      educationLevel: "undergrad",
      subjects: ["math", "computer_science"],
      summaryStyle: "brief",
    });
    expect(result.success).toBe(true);
  });

  it("coerces year of birth from string", () => {
    const result = onboardingInputSchema.safeParse({
      yearOfBirth: "1998",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.yearOfBirth).toBe(1998);
    }
  });

  it("treats empty strings as omitted", () => {
    const result = onboardingInputSchema.safeParse({
      yearOfBirth: "",
      educationLevel: "",
      subjects: [],
      summaryStyle: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.yearOfBirth).toBeUndefined();
      expect(result.data.educationLevel).toBeUndefined();
      expect(result.data.subjects).toBeUndefined();
      expect(result.data.summaryStyle).toBeUndefined();
    }
  });

  it("rejects invalid education level", () => {
    const result = onboardingInputSchema.safeParse({
      educationLevel: "phd_candidate",
    });
    expect(result.success).toBe(false);
  });

  it("rejects year of birth out of range", () => {
    expect(
      onboardingInputSchema.safeParse({ yearOfBirth: 1899 }).success,
    ).toBe(false);
    expect(
      onboardingInputSchema.safeParse({ yearOfBirth: 3000 }).success,
    ).toBe(false);
  });

  it("rejects unknown subjects", () => {
    const result = onboardingInputSchema.safeParse({
      subjects: ["astrology"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown summary style", () => {
    expect(
      onboardingInputSchema.safeParse({ summaryStyle: "novel" }).success,
    ).toBe(false);
  });
});
