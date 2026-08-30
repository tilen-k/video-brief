import type { GeneratedSection } from "@/db/schema";

export function sortSectionsByStartTime(
  sections: GeneratedSection[],
): GeneratedSection[] {
  return [...sections].sort(
    (a, b) => a.startTime - b.startTime || a.endTime - b.endTime,
  );
}

/**
 * Models sometimes emit endTime as a duration (seconds long) instead of an
 * absolute timestamp. When end <= start, treat end as a duration.
 */
export function resolveSectionEndTime(startTime: number, endTime: number): number {
  if (endTime <= startTime) {
    return startTime + endTime;
  }
  return endTime;
}

export function clampSectionTimes(
  sections: GeneratedSection[],
  durationSeconds: number | null,
): GeneratedSection[] {
  const max =
    durationSeconds != null && durationSeconds > 0
      ? durationSeconds
      : Number.POSITIVE_INFINITY;

  const normalized = sortSectionsByStartTime(
    sections.map((section) => {
      const startTime = Math.max(0, section.startTime);
      const endTime = resolveSectionEndTime(startTime, section.endTime);
      return { ...section, startTime, endTime };
    }),
  );

  // Drop sections that start at/after the video end — pinning them to `max`
  // made every late section display as the duration timestamp (e.g. 15:20).
  let clamped = normalized
    .filter((section) => section.startTime < max)
    .map((section) => {
      const startTime = Math.min(section.startTime, max);
      const endTime = Math.min(Math.max(startTime, section.endTime), max);
      return { ...section, startTime, endTime };
    });

  if (clamped.length === 0 && normalized.length > 0 && Number.isFinite(max)) {
    const first = normalized[0];
    clamped = [{ ...first, startTime: 0, endTime: max }];
  }

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
