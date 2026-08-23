import { describe, expect, it } from "vitest";

import { prefsToAsk } from "./prefs-to-ask";

describe("prefsToAsk", () => {
  it("asks length always and familiarity when educational with a topic", () => {
    expect(
      prefsToAsk({
        isEducational: true,
        confidence: "high",
        topic: "Taylor series",
      }),
    ).toEqual({ askFamiliarity: true, askLength: true });
  });

  it("skips familiarity when not educational", () => {
    expect(
      prefsToAsk({
        isEducational: false,
        confidence: "high",
        topic: "vlog",
      }),
    ).toEqual({ askFamiliarity: false, askLength: true });
  });

  it("skips familiarity when topic is missing", () => {
    expect(
      prefsToAsk({
        isEducational: true,
        confidence: "medium",
        topic: null,
      }),
    ).toEqual({ askFamiliarity: false, askLength: true });
  });
});
