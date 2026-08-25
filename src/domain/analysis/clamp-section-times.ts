import type { GeneratedSection } from "@/db/schema";

export function clampSectionTimes(
  sections: GeneratedSection[],
  durationSeconds: number | null,
): GeneratedSection[] {
  const max =
    durationSeconds != null && durationSeconds > 0
      ? durationSeconds
      : Number.POSITIVE_INFINITY;

  return sections.map((section) => {
    const startTime = Math.min(Math.max(0, section.startTime), max);
    const endTime = Math.min(Math.max(startTime, section.endTime), max);
    return { ...section, startTime, endTime };
  });
}
