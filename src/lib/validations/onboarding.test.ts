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

  it("accepts filled educational fields", () => {
    const result = onboardingInputSchema.safeParse({
      yearOfBirth: 2003,
      educationLevel: "undergrad",
      subjects: ["math", "computer_science"],
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
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.yearOfBirth).toBeUndefined();
      expect(result.data.educationLevel).toBeUndefined();
      expect(result.data.subjects).toBeUndefined();
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
});

describe("onboardingToContextEntries", () => {
  it("maps educational fields and omits empties", () => {
    const parsed = onboardingInputSchema.parse({
      yearOfBirth: 2001,
      educationLevel: "high_school",
      subjects: ["math", "other", "math"],
    });
    expect(onboardingToContextEntries(parsed)).toEqual([
      { key: "year_of_birth", value: "2001" },
      { key: "education_level", value: "high_school" },
      { key: "subjects", value: "math,other" },
    ]);
  });

  it("returns no entries for full skip", () => {
    expect(onboardingToContextEntries({})).toEqual([]);
  });
});
