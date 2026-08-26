import { describe, expect, it } from "vitest";

import { isAnonymousUser, isGuestUser } from "./is-anonymous";
import { guestDisplayName } from "./guest-display-name";
import { safeInternalPath } from "./safe-next-path";

describe("isAnonymousUser", () => {
  it("is true only when is_anonymous is true", () => {
    expect(isAnonymousUser({ is_anonymous: true })).toBe(true);
    expect(isAnonymousUser({ is_anonymous: false })).toBe(false);
    expect(isAnonymousUser({})).toBe(false);
    expect(isAnonymousUser(null)).toBe(false);
  });
});

describe("isGuestUser", () => {
  it("is false once an email is attached (convert in progress)", () => {
    expect(isGuestUser({ is_anonymous: true, email: "a@b.com" })).toBe(false);
    expect(isGuestUser({ is_anonymous: true, email: null })).toBe(true);
    expect(isGuestUser({ is_anonymous: false, email: null })).toBe(false);
  });
});

describe("guestDisplayName", () => {
  it("prefixes guest and uses first 8 hex chars of uuid", () => {
    expect(guestDisplayName("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "guesta1b2c3d4",
    );
  });
});

describe("safeInternalPath", () => {
  it("allows relative paths and rejects open redirects", () => {
    expect(safeInternalPath("/v/abc")).toBe("/v/abc");
    expect(safeInternalPath("/")).toBe("/");
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil")).toBe("/");
    expect(safeInternalPath(null, "/account")).toBe("/account");
  });
});
