import type { GeneratedSection } from "@/db/schema";

export function sortSectionsByStartTime(
  sections: GeneratedSection[],
): GeneratedSection[] {
  return [...sections].sort(
    (a, b) => a.startTime - b.startTime || a.endTime - b.endTime,
  );
}

export function clampSectionTimes(
  sections: GeneratedSection[],
  durationSeconds: number | null,
): GeneratedSection[] {
  const max =
    durationSeconds != null && durationSeconds > 0
      ? durationSeconds
      : Number.POSITIVE_INFINITY;

  const clamped = sortSectionsByStartTime(
    sections.map((section) => {
      const startTime = Math.min(Math.max(0, section.startTime), max);
      const endTime = Math.min(Math.max(startTime, section.endTime), max);
      return { ...section, startTime, endTime };
    }),
  );

  if (
    durationSeconds != null &&
    durationSeconds > 0 &&
    clamped.length > 0
  ) {
    const last = clamped.length - 1;
    clamped[last] = { ...clamped[last], endTime: durationSeconds };
  }

  return clamped;
}
