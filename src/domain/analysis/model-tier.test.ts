import { describe, expect, it, afterEach } from "vitest";

import { analysisConfig } from "@/domain/analysis/config";
import {
  assertRunnableModelTier,
  defaultModelTierForPlan,
  isAdvancedModelEnabled,
  modelIdForPlan,
  modelIdForTier,
  preferredModelTierFromUsage,
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

  it("defaults all plans to advanced when enabled", () => {
    expect(modelIdForPlan("free")).toBe(analysisConfig.models.advancedId);
    expect(modelIdForPlan("pro")).toBe(analysisConfig.models.advancedId);
    expect(defaultModelTierForPlan("free")).toBe("advanced");
    expect(defaultModelTierForPlan("pro")).toBe("advanced");
  });

  it("honors explicit choice when advanced is enabled", () => {
    expect(resolveModelTier("free", "basic")).toBe("basic");
    expect(resolveModelTier("free", "advanced")).toBe("advanced");
    expect(resolveModelTier("pro", "basic")).toBe("basic");
    expect(resolveModelTier("pro", "advanced")).toBe("advanced");
    expect(resolveModelTier("free")).toBe("advanced");
  });

  it("disables advanced when ADVANCED_MODEL_ENABLED=0", () => {
    process.env.ADVANCED_MODEL_ENABLED = "0";
    expect(isAdvancedModelEnabled()).toBe(false);
    expect(resolveModelTier("pro", "advanced")).toBe("basic");
    expect(modelIdForPlan("pro")).toBe(analysisConfig.models.basicId);
    expect(assertRunnableModelTier("advanced")).toBe("basic");
  });

  it("prefers advanced from usage when quota remains", () => {
    expect(
      preferredModelTierFromUsage(true, { used: 2, limit: 5 }),
    ).toBe("advanced");
    expect(
      preferredModelTierFromUsage(true, { used: 5, limit: 5 }),
    ).toBe("basic");
  });

  it("assertRunnableModelTier trusts stored tier when enabled", () => {
    expect(assertRunnableModelTier("advanced")).toBe("advanced");
    expect(assertRunnableModelTier("basic")).toBe("basic");
    expect(assertRunnableModelTier(null)).toBe("basic");
  });
});
