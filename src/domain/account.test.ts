import { describe, expect, it } from "vitest";

import { userHasPassword } from "./account";

describe("userHasPassword", () => {
  it("is true for email-only identities", () => {
    expect(
      userHasPassword({
        identities: [{ provider: "email" }],
        app_metadata: { providers: ["email"] },
      }),
    ).toBe(true);
  });

  it("is false for google-only identities", () => {
    expect(
      userHasPassword({
        identities: [{ provider: "google" }],
        app_metadata: { provider: "google", providers: ["google"] },
      }),
    ).toBe(false);
  });

  it("is true when both google and email identities exist", () => {
    expect(
      userHasPassword({
        identities: [{ provider: "google" }, { provider: "email" }],
        app_metadata: { provider: "google", providers: ["google", "email"] },
      }),
    ).toBe(true);
  });

  it("falls back to providers when identities are empty", () => {
    expect(
      userHasPassword({
        identities: [],
        app_metadata: { providers: ["email"] },
      }),
    ).toBe(true);
  });

  it("is false when identities and providers are empty arrays", () => {
    expect(
      userHasPassword({
        identities: [],
        app_metadata: { providers: [] },
      }),
    ).toBe(false);
  });

  it("is true for an email identity even if singular provider is google", () => {
    expect(
      userHasPassword({
        identities: [{ provider: "email" }],
        app_metadata: { provider: "google", providers: ["google"] },
      }),
    ).toBe(true);
  });

  it("is true for singular email provider when lists are missing", () => {
    expect(
      userHasPassword({
        app_metadata: { provider: "email" },
      }),
    ).toBe(true);
  });

  it("fails closed when identity and provider lists are missing", () => {
    expect(userHasPassword({})).toBe(true);
  });
});
