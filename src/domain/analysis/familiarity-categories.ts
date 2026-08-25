/**
 * YouTube categories that show the familiarity slider and include
 * familiarity in the generate prompt.
 *
 * Canonical Data API ids plus English labels — youtubei may store either
 * shape in `youtube_category_id`.
 */
export const FAMILIARITY_CATEGORY_IDS = ["27", "26", "28", "25"] as const;

export const FAMILIARITY_CATEGORY_LABELS = [
  "Education",
  "Howto & Style",
  "Science & Technology",
  "News & Politics",
] as const;

const ID_SET = new Set<string>(FAMILIARITY_CATEGORY_IDS);

const LABEL_SET = new Set(
  FAMILIARITY_CATEGORY_LABELS.map((label) => normalizeCategoryKey(label)),
);

function normalizeCategoryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when the category id or English label qualifies for familiarity. */
export function showFamiliaritySlider(
  category: string | null | undefined,
): boolean {
  if (category == null) {
    return false;
  }
  const trimmed = category.trim();
  if (!trimmed) {
    return false;
  }
  if (ID_SET.has(trimmed)) {
    return true;
  }
  return LABEL_SET.has(normalizeCategoryKey(trimmed));
}
