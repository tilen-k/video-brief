import type { ClassificationSnapshot } from "@/db/schema";

export type PrefsToAsk = {
  askFamiliarity: boolean;
  askLength: boolean;
};

/**
 * Product-owned selects after classify.
 * MVP: always offer length (including non-edu). Familiarity only when
 * educational and a topic label exists.
 */
export function prefsToAsk(
  classification: ClassificationSnapshot | null,
): PrefsToAsk {
  const topic = classification?.topic?.trim();
  return {
    askFamiliarity: Boolean(classification?.isEducational && topic),
    askLength: true,
  };
}
