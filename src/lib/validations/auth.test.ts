import { describe, expect, it } from "vitest";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

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
