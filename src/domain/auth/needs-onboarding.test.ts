import { describe, expect, it, vi } from "vitest";

import { needsOnboarding } from "./needs-onboarding";

vi.mock("@/domain/onboarding", () => ({
  getOnboardingCompleted: vi.fn(async (userId: string) => userId === "done"),
}));

describe("needsOnboarding", () => {
  it("is false for guests even if profile incomplete", async () => {
    await expect(
      needsOnboarding({ id: "guest-1", is_anonymous: true, email: null }),
    ).resolves.toBe(false);
  });

  it("allows onboarding when email is attached during soft-confirm convert", async () => {
    await expect(
      needsOnboarding({
        id: "converting",
        is_anonymous: true,
        email: "a@b.com",
      }),
    ).resolves.toBe(true);
  });

  it("follows onboarding_completed for permanent users", async () => {
    await expect(
      needsOnboarding({ id: "new", is_anonymous: false }),
    ).resolves.toBe(true);
    await expect(
      needsOnboarding({ id: "done", is_anonymous: false }),
    ).resolves.toBe(false);
  });
});
