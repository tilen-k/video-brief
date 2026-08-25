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
});
