export const PREF_SCORE_MIN = 0;
export const PREF_SCORE_MAX = 100;
export const DEFAULT_FAMILIARITY_SCORE = 50;
export const DEFAULT_LENGTH_SCORE = 50;
export const DEFAULT_TONE_SCORE = 50;

export function clampPrefScore(value: number): number {
  return Math.min(PREF_SCORE_MAX, Math.max(PREF_SCORE_MIN, Math.round(value)));
}
