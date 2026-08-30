import type { TranscriptSegment } from "@/db/schema";

type Json3Segment = {
  utf8?: string;
};

type Json3Event = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Json3Segment[];
};

type Json3CaptionPayload = {
  events?: Json3Event[];
};

/** ASR karaoke windows mark the spoken cursor with U+200B. */
export function normalizeCaptionText(text: string): string {
  return text.replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Parse YouTube timedtext `fmt=json3` payload into timestamped segments.
 * Coalesces rolling ASR updates that re-emit the same line while the
 * highlight cursor advances.
 */
export function parseCaptionJson3(raw: string): TranscriptSegment[] {
  let payload: Json3CaptionPayload;
  try {
    payload = JSON.parse(raw) as Json3CaptionPayload;
  } catch {
    return [];
  }

  const segments: TranscriptSegment[] = [];

  for (const event of payload.events ?? []) {
    const text = normalizeCaptionText(
      (event.segs ?? []).map((segment) => segment.utf8 ?? "").join(""),
    );
    const startMs = Number(event.tStartMs);
    if (!text || !Number.isFinite(startMs)) {
      continue;
    }

    const durationMs = Number(event.dDurationMs);
    const endMs =
      Number.isFinite(durationMs) && durationMs > 0
        ? startMs + durationMs
        : undefined;

    const last = segments[segments.length - 1];
    if (last && normalizeCaptionText(last.text) === text) {
      if (endMs !== undefined) {
        last.endMs = endMs;
      }
      continue;
    }

    segments.push({
      startMs,
      ...(endMs !== undefined ? { endMs } : {}),
      text,
    });
  }

  return segments;
}
