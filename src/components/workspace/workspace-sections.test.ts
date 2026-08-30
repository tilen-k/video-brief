import { describe, expect, it } from "vitest";

import { formatSectionTime, isActiveSection } from "./workspace-sections";

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

describe("formatSectionTime", () => {
  it("formats under an hour as m:ss", () => {
    expect(formatSectionTime(0)).toBe("0:00");
    expect(formatSectionTime(7)).toBe("0:07");
    expect(formatSectionTime(65)).toBe("1:05");
    expect(formatSectionTime(59 * 60 + 59)).toBe("59:59");
  });

  it("formats over an hour as h:mm:ss", () => {
    expect(formatSectionTime(3600)).toBe("1:00:00");
    expect(formatSectionTime(69 * 60 + 16)).toBe("1:09:16");
    expect(formatSectionTime(1 * 3600 + 22 * 60 + 44)).toBe("1:22:44");
  });
});
