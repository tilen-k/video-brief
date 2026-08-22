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

/**
 * Parse YouTube timedtext `fmt=json3` payload into timestamped segments.
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
    const text = (event.segs ?? [])
      .map((segment) => segment.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    const startMs = Number(event.tStartMs);
    if (!text || !Number.isFinite(startMs)) {
      continue;
    }

    const durationMs = Number(event.dDurationMs);
    const endMs =
      Number.isFinite(durationMs) && durationMs > 0
        ? startMs + durationMs
        : undefined;

    segments.push({
      startMs,
      ...(endMs !== undefined ? { endMs } : {}),
      text,
    });
  }

  return segments;
}
