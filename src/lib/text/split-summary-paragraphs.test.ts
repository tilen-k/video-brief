import { describe, expect, it } from "vitest";

import { splitSummaryParagraphs } from "./split-summary-paragraphs";

describe("splitSummaryParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitSummaryParagraphs("First para.\n\nSecond para.")).toEqual([
      "First para.",
      "Second para.",
    ]);
  });

  it("returns a single paragraph when no blank lines", () => {
    expect(splitSummaryParagraphs("One block only.")).toEqual(["One block only."]);
  });
});
