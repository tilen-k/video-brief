import { describe, expect, it } from "vitest";

import { clampSectionTimes } from "./clamp-section-times";

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
});
