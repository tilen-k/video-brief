import { describe, expect, it } from "vitest";

import { parseCaptionJson3 } from "@/lib/youtube/parse-caption-json3";

describe("parseCaptionJson3", () => {
  it("parses events with start and duration", () => {
    const raw = JSON.stringify({
      events: [
        {
          tStartMs: 0,
          dDurationMs: 4440,
          segs: [{ utf8: "Hello world" }],
        },
        {
          tStartMs: 6720,
          dDurationMs: 5280,
          segs: [{ utf8: "Second line" }],
        },
      ],
    });

    expect(parseCaptionJson3(raw)).toEqual([
      { startMs: 0, endMs: 4440, text: "Hello world" },
      { startMs: 6720, endMs: 12000, text: "Second line" },
    ]);
  });

  it("joins multi-seg utf8 and collapses whitespace", () => {
    const raw = JSON.stringify({
      events: [
        {
          tStartMs: 100,
          segs: [{ utf8: "Part one " }, { utf8: "part two" }],
        },
      ],
    });

    expect(parseCaptionJson3(raw)).toEqual([
      { startMs: 100, text: "Part one part two" },
    ]);
  });

  it("returns empty array for invalid json or no events", () => {
    expect(parseCaptionJson3("not json")).toEqual([]);
    expect(parseCaptionJson3("{}")).toEqual([]);
  });
});
