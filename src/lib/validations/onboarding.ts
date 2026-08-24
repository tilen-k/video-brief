import { z } from "zod";

import {
  EDUCATION_LEVELS,
  MIN_YEAR_OF_BIRTH,
  SUBJECTS,
  SUMMARY_STYLES,
  maxYearOfBirth,
} from "./onboarding-options";

export {
  EDUCATION_LEVELS,
  MIN_YEAR_OF_BIRTH,
  SUBJECTS,
  SUMMARY_STYLES,
  maxYearOfBirth,
  type EducationLevel,
  type Subject,
  type SummaryStyle,
} from "./onboarding-options";

export const educationLevelSchema = z.enum(EDUCATION_LEVELS);
export const subjectSchema = z.enum(SUBJECTS);
export const summaryStyleSchema = z.enum(SUMMARY_STYLES);

const emptyToUndefined = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
};

const yearOfBirthSchema = z.preprocess((value) => {
  const emptied = emptyToUndefined(value);
  if (emptied === undefined) {
    return undefined;
  }
  if (typeof emptied === "number" && Number.isFinite(emptied)) {
    return emptied;
  }
  if (typeof emptied === "string") {
    const trimmed = emptied.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : emptied;
  }
  return emptied;
}, z.number().int().optional()).superRefine((value, ctx) => {
  if (value === undefined) {
    return;
  }
  const max = maxYearOfBirth();
  if (value < MIN_YEAR_OF_BIRTH || value > max) {
    ctx.addIssue({
      code: "custom",
      message: `Year of birth must be between ${MIN_YEAR_OF_BIRTH} and ${max}`,
    });
  }
});

const subjectsSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (Array.isArray(value)) {
    const filtered = value.filter((item) => item !== "" && item != null);
    return filtered.length > 0 ? filtered : undefined;
  }
  if (typeof value === "string") {
    return [value];
  }
  return value;
}, z.array(subjectSchema).max(SUBJECTS.length).optional());

export const onboardingInputSchema = z.object({
  yearOfBirth: yearOfBirthSchema,
  educationLevel: z.preprocess(
    emptyToUndefined,
    educationLevelSchema.optional(),
  ),
  subjects: subjectsSchema,
  summaryStyle: z.preprocess(
    emptyToUndefined,
    summaryStyleSchema.optional(),
  ),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
