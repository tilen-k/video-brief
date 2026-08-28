import { describe, expect, it, afterEach } from "vitest";

import { analysisConfig } from "@/domain/analysis/config";
import {
  defaultModelTierForPlan,
  isAdvancedModelEnabled,
  modelIdForPlan,
  modelIdForTier,
  resolveModelTier,
} from "@/domain/analysis/model-tier";

describe("model tier", () => {
  afterEach(() => {
    delete process.env.ADVANCED_MODEL_ENABLED;
  });

  it("maps tiers to configured model ids", () => {
    expect(modelIdForTier("basic")).toBe(analysisConfig.models.basicId);
    expect(modelIdForTier("advanced")).toBe(analysisConfig.models.advancedId);
  });

  it("maps free to basic and pro to advanced when enabled", () => {
    expect(modelIdForPlan("free")).toBe(analysisConfig.models.basicId);
    expect(modelIdForPlan("pro")).toBe(analysisConfig.models.advancedId);
  });

  it("defaults pro to advanced and free to basic", () => {
    expect(defaultModelTierForPlan("free")).toBe("basic");
    expect(defaultModelTierForPlan("pro")).toBe("advanced");
  });

  it("honors pro choice when advanced is enabled", () => {
    expect(resolveModelTier("pro", "basic")).toBe("basic");
    expect(resolveModelTier("pro", "advanced")).toBe("advanced");
    expect(resolveModelTier("pro")).toBe("advanced");
  });

  it("rejects advanced for free users", () => {
    expect(resolveModelTier("free", "advanced")).toBe("basic");
  });

  it("disables advanced when ADVANCED_MODEL_ENABLED=0", () => {
    process.env.ADVANCED_MODEL_ENABLED = "0";
    expect(isAdvancedModelEnabled()).toBe(false);
    expect(resolveModelTier("pro", "advanced")).toBe("basic");
    expect(modelIdForPlan("pro")).toBe(analysisConfig.models.basicId);
  });
});
