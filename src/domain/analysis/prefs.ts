import {
  SUMMARY_STYLES,
  type SummaryStyle,
} from "@/lib/validations/onboarding-options";

export { SUMMARY_STYLES };
export type { SummaryStyle };

export const PREF_SCORE_MIN = 0;
export const PREF_SCORE_MAX = 100;
export const DEFAULT_FAMILIARITY_SCORE = 50;
export const DEFAULT_LENGTH_SCORE = 50;

export function defaultLengthScore(
  style: SummaryStyle | null | undefined,
): number {
  switch (style) {
    case "brief":
      return 25;
    case "extensive":
      return 75;
    default:
      return DEFAULT_LENGTH_SCORE;
  }
}

export function clampPrefScore(value: number): number {
  return Math.min(PREF_SCORE_MAX, Math.max(PREF_SCORE_MIN, Math.round(value)));
}
