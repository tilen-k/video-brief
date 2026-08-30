import type { TranscriptSegment } from "@/db/schema";

import { analysisConfig } from "./config";

const {
  charBudget: TRANSCRIPT_CHAR_BUDGET,
  firstWindowMs: FIRST_WINDOW_MS,
  lastWindowMs: LAST_WINDOW_MS,
  midWindowMs: MID_WINDOW_MS,
  midWindowCount: MID_WINDOW_COUNT,
} = analysisConfig.transcript;

export function formatTranscriptTimestamp(startMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  return `[${totalSeconds}]`;
}

export function formatTranscriptLine(segment: TranscriptSegment): string {
  return `${formatTranscriptTimestamp(segment.startMs)} ${segment.text.trim()}`;
}

function durationMs(
  segments: TranscriptSegment[],
  durationSeconds: number | null,
): number {
  if (durationSeconds != null && durationSeconds > 0) {
    return durationSeconds * 1000;
  }

  let max = 0;
  for (const segment of segments) {
    max = Math.max(max, segment.endMs ?? segment.startMs);
  }
  return max;
}

function inRange(
  segment: TranscriptSegment,
  startMs: number,
  endMs: number,
): boolean {
  return segment.startMs >= startMs && segment.startMs < endMs;
}

function segmentId(segment: TranscriptSegment): string {
  return `${segment.startMs}:${segment.text}`;
}

function packLines(
  segments: TranscriptSegment[],
  budget: number,
): string {
  const lines: string[] = [];
  let size = 0;

  for (const segment of segments) {
    const line = formatTranscriptLine(segment);
    const extra = lines.length === 0 ? line.length : line.length + 1;
    if (size + extra > budget && lines.length > 0) {
      break;
    }
    lines.push(line);
    size += extra;
  }

  return lines.join("\n");
}

/**
 * ~12k caption chars. If over budget: first 3 min + last 1 min + up to 4
 * mid ~45s windows. Format `[seconds] text`.
 */
export function selectTranscriptSubset(
  segments: TranscriptSegment[],
  durationSeconds: number | null,
  charBudget: number = TRANSCRIPT_CHAR_BUDGET,
): string {
  if (segments.length === 0) {
    return "";
  }

  const full = packLines(segments, Number.POSITIVE_INFINITY);
  if (full.length <= charBudget) {
    return full;
  }

  const duration = durationMs(segments, durationSeconds);
  const lastStart = Math.max(0, duration - LAST_WINDOW_MS);
  const first = segments.filter((segment) =>
    inRange(segment, 0, FIRST_WINDOW_MS),
  );
  const last = segments.filter((segment) => segment.startMs >= lastStart);

  const midStart = FIRST_WINDOW_MS;
  const midEnd = lastStart;
  const mid: TranscriptSegment[] = [];

  if (midEnd > midStart) {
    const usable = Math.max(0, midEnd - midStart - MID_WINDOW_MS);
    for (let i = 0; i < MID_WINDOW_COUNT; i++) {
      const start =
        midStart + Math.floor((i * usable) / Math.max(MID_WINDOW_COUNT - 1, 1));
      const end = start + MID_WINDOW_MS;
      for (const segment of segments) {
        if (inRange(segment, start, end)) {
          mid.push(segment);
        }
      }
    }
  }

  const seen = new Set<string>();
  const ordered: TranscriptSegment[] = [];
  for (const segment of [...first, ...mid, ...last].sort(
    (a, b) => a.startMs - b.startMs,
  )) {
    const id = segmentId(segment);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(segment);
  }

  return packLines(ordered, charBudget);
}
