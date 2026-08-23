import {
  FAMILIARITY_LEVELS,
  SUMMARY_STYLES,
  type FamiliarityLevel,
  type SummaryStyle,
} from "@/lib/validations/onboarding-options";

export { FAMILIARITY_LEVELS, SUMMARY_STYLES };
export type { FamiliarityLevel, SummaryStyle };

export const DEFAULT_SUMMARY_LENGTH: SummaryStyle = "moderate";

export function defaultSummaryLength(
  style: SummaryStyle | null | undefined,
): SummaryStyle {
  return style ?? DEFAULT_SUMMARY_LENGTH;
}
