import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  createPasswordSchema,
  credentialsSchema,
} from "./auth";

describe("credentialsSchema", () => {
  it("accepts valid credentials", () => {
    const result = credentialsSchema.safeParse({
      email: "user@videobrief.app",
      password: "password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short passwords", () => {
    const result = credentialsSchema.safeParse({
      email: "user@videobrief.app",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const result = createPasswordSchema.safeParse({
      newPassword: "password1",
      confirmPassword: "password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short new passwords", () => {
    const result = createPasswordSchema.safeParse({
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    const result = createPasswordSchema.safeParse({
      newPassword: "password1",
      confirmPassword: "password2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Passwords do not match");
    }
  });
});

describe("changePasswordSchema", () => {
  it("accepts a different matching new password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "password1",
      newPassword: "password2",
      confirmPassword: "password2",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when new password matches current", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "password1",
      newPassword: "password1",
      confirmPassword: "password1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message ===
            "New password must be different from your current password",
        ),
      ).toBe(true);
    }
  });

  it("rejects mismatched confirmation", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "password1",
      newPassword: "password2",
      confirmPassword: "password3",
    });
    expect(result.success).toBe(false);
  });
});
