/** Shared onboarding option constants (safe for client + server; no Zod). */

export const EDUCATION_LEVELS = [
  "middle_school",
  "high_school",
  "undergrad",
  "grad",
  "bootcamp",
  "self_taught",
  "other",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const SUBJECTS = [
  "math",
  "physics",
  "chemistry",
  "biology",
  "computer_science",
  "engineering",
  "economics",
  "history",
  "languages",
  "other",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const MIN_YEAR_OF_BIRTH = 1900;

export const SUMMARY_STYLES = ["brief", "moderate", "extensive"] as const;

export type SummaryStyle = (typeof SUMMARY_STYLES)[number];

export const FAMILIARITY_LEVELS = [
  "not_familiar",
  "somewhat",
  "very",
] as const;

export type FamiliarityLevel = (typeof FAMILIARITY_LEVELS)[number];

/** Current calendar year (UTC) for YOB upper bound. */
export function maxYearOfBirth(now = new Date()): number {
  return now.getUTCFullYear();
}
