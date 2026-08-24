import { describe, expect, it } from "vitest";

import { modelIdForPlan, analysisConfig } from "@/domain/analysis/config";

describe("modelIdForPlan", () => {
  it("maps free to basic and pro to advanced scaffold ids", () => {
    expect(modelIdForPlan("free")).toBe(analysisConfig.models.basicId);
    expect(modelIdForPlan("pro")).toBe(analysisConfig.models.advancedId);
  });
});
