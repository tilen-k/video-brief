import { describe, expect, it } from "vitest";

import { getClientIpFromHeaders } from "@/domain/usage/client-ip";

describe("getClientIpFromHeaders", () => {
  it("reads the first x-forwarded-for address", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.1, 70.41.3.18",
    });
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.2",
    });
    expect(getClientIpFromHeaders(headers)).toBe("198.51.100.2");
  });

  it("returns null when no proxy headers are present", () => {
    expect(getClientIpFromHeaders(new Headers())).toBeNull();
  });
});
