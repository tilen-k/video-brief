import { describe, expect, it } from "vitest";

import {
  normalizeCaptionText,
  parseCaptionJson3,
} from "@/lib/youtube/parse-caption-json3";

describe("normalizeCaptionText", () => {
  it("strips zero-width spaces used as ASR cursors", () => {
    expect(normalizeCaptionText("Hello​ world")).toBe("Hello world");
  });
});

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

  it("coalesces rolling ASR karaoke updates into one segment", () => {
    const raw = JSON.stringify({
      events: [
        {
          tStartMs: 420,
          dDurationMs: 560,
          segs: [{ utf8: "YouTube's update is worse than I thought" }],
        },
        {
          tStartMs: 980,
          dDurationMs: 190,
          segs: [{ utf8: "YouTube's update\u200b is worse than I thought" }],
        },
        {
          tStartMs: 1170,
          dDurationMs: 310,
          segs: [{ utf8: "YouTube's update is\u200b worse than I thought" }],
        },
        {
          tStartMs: 4500,
          dDurationMs: 300,
          segs: [{ utf8: "about YouTube video, but fortunately" }],
        },
      ],
    });

    expect(parseCaptionJson3(raw)).toEqual([
      {
        startMs: 420,
        endMs: 1480,
        text: "YouTube's update is worse than I thought",
      },
      {
        startMs: 4500,
        endMs: 4800,
        text: "about YouTube video, but fortunately",
      },
    ]);
  });

  it("returns empty array for invalid json or no events", () => {
    expect(parseCaptionJson3("not json")).toEqual([]);
    expect(parseCaptionJson3("{}")).toEqual([]);
  });
});
