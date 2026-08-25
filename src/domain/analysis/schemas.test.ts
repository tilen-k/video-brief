import { describe, expect, it } from "vitest";

import { generateSectionsSchema } from "./schemas";

describe("generateSectionsSchema", () => {
  it("accepts a summary and sections", () => {
    const result = generateSectionsSchema.parse({
      summary: "Overview of the lecture.",
      sections: [
        {
          title: "Intro",
          startTime: 0,
          endTime: 10,
          body: "Opening.",
        },
      ],
    });
    expect(result.summary).toContain("Overview");
    expect(result.sections).toHaveLength(1);
  });

  it("rejects empty sections", () => {
    const result = generateSectionsSchema.safeParse({
      summary: "Overview",
      sections: [],
    });
    expect(result.success).toBe(false);
  });
});
