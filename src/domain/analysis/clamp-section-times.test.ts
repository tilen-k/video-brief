import { describe, expect, it } from "vitest";

import {
  clampSectionTimes,
  resolveSectionEndTime,
} from "./clamp-section-times";

describe("resolveSectionEndTime", () => {
  it("keeps absolute end times greater than start", () => {
    expect(resolveSectionEndTime(36, 53)).toBe(53);
  });

  it("treats endTime as a duration when it is at or below startTime", () => {
    expect(resolveSectionEndTime(633, 15)).toBe(648);
    expect(resolveSectionEndTime(100, 100)).toBe(200);
  });
});

describe("clampSectionTimes", () => {
  it("clamps section times to the video duration", () => {
    expect(
      clampSectionTimes(
        [{ title: "A", startTime: -5, endTime: 999, body: "x" }],
        60,
      ),
    ).toEqual([{ title: "A", startTime: 0, endTime: 60, body: "x" }]);
  });

  it("leaves times alone when duration is unknown", () => {
    expect(
      clampSectionTimes(
        [{ title: "A", startTime: 1, endTime: 2, body: "x" }],
        null,
      ),
    ).toEqual([{ title: "A", startTime: 1, endTime: 2, body: "x" }]);
  });

  it("extends the last section end time to the video duration", () => {
    expect(
      clampSectionTimes(
        [{ title: "A", startTime: 0, endTime: 50, body: "x" }],
        120,
      ),
    ).toEqual([{ title: "A", startTime: 0, endTime: 120, body: "x" }]);
  });

  it("sorts sections chronologically before extending the final end time", () => {
    expect(
      clampSectionTimes(
        [
          { title: "Late", startTime: 1842, endTime: 2000, body: "late" },
          { title: "Early", startTime: 335, endTime: 400, body: "early" },
        ],
        2000,
      ),
    ).toEqual([
      { title: "Early", startTime: 335, endTime: 400, body: "early" },
      { title: "Late", startTime: 1842, endTime: 2000, body: "late" },
    ]);
  });

  it("converts duration-style endTimes before clamping", () => {
    expect(
      clampSectionTimes(
        [
          { title: "A", startTime: 0, endTime: 6, body: "a" },
          { title: "B", startTime: 36, endTime: 17, body: "b" },
          { title: "C", startTime: 633, endTime: 15, body: "c" },
        ],
        920,
      ),
    ).toEqual([
      { title: "A", startTime: 0, endTime: 6, body: "a" },
      { title: "B", startTime: 36, endTime: 53, body: "b" },
      { title: "C", startTime: 633, endTime: 920, body: "c" },
    ]);
  });

  it("drops sections that start at or past the video duration", () => {
    expect(
      clampSectionTimes(
        [
          { title: "Ok", startTime: 633, endTime: 715, body: "ok" },
          { title: "Past", startTime: 1337, endTime: 1407, body: "past" },
          { title: "Also past", startTime: 1454, endTime: 1518, body: "x" },
        ],
        920,
      ),
    ).toEqual([{ title: "Ok", startTime: 633, endTime: 920, body: "ok" }]);
  });

  it("falls back to a full-video section when every start is past duration", () => {
    expect(
      clampSectionTimes(
        [{ title: "Past", startTime: 1337, endTime: 1407, body: "past" }],
        920,
      ),
    ).toEqual([{ title: "Past", startTime: 0, endTime: 920, body: "past" }]);
  });
});
