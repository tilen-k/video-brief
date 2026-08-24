import { describe, expect, it } from "vitest";

import { userVideoIdSchema } from "./workspace";

describe("userVideoIdSchema", () => {
  it("accepts a UUID", () => {
    const result = userVideoIdSchema.safeParse(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(result.success).toBe(true);
  });

  it("rejects a YouTube id or empty value", () => {
    expect(userVideoIdSchema.safeParse("dQw4w9WgXcQ").success).toBe(false);
    expect(userVideoIdSchema.safeParse("").success).toBe(false);
    expect(userVideoIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
