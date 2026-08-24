import { describe, expect, it } from "vitest";

import { analyzeJobId } from "./types";

describe("analyzeJobId", () => {
  it("does not include a colon (BullMQ custom ids forbid it)", () => {
    const id = analyzeJobId(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(id).not.toContain(":");
    expect(id).toBe(
      "11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222",
    );
  });
});
