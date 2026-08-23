import { describe, expect, it } from "vitest";

import { isActiveSection } from "./workspace-sections";

describe("isActiveSection", () => {
  const section = {
    title: "Intro",
    startTime: 10,
    endTime: 20,
    body: "body",
  };

  it("is active in [start, end)", () => {
    expect(isActiveSection(section, 10)).toBe(true);
    expect(isActiveSection(section, 19.9)).toBe(true);
    expect(isActiveSection(section, 20)).toBe(false);
    expect(isActiveSection(section, 9)).toBe(false);
  });
});
