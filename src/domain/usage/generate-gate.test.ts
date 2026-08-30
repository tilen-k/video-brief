import { describe, expect, it } from "vitest";

import { evaluateGenerateGate } from "./generate-gate";

describe("evaluateGenerateGate", () => {
  it("blocks when both tiers are exhausted", () => {
    expect(
      evaluateGenerateGate({
        durationSeconds: 60,
        selectedTier: "basic",
        basicAvailable: false,
        advancedAvailable: false,
      }),
    ).toEqual({ ok: false, reason: "both_exhausted" });
  });

  it("blocks selected basic when basic quota is gone", () => {
    expect(
      evaluateGenerateGate({
        durationSeconds: 60,
        selectedTier: "basic",
        basicAvailable: false,
        advancedAvailable: true,
      }),
    ).toEqual({ ok: false, reason: "selected_exhausted" });
  });

  it("blocks unknown duration", () => {
    expect(
      evaluateGenerateGate({
        durationSeconds: null,
        selectedTier: "advanced",
        basicAvailable: true,
        advancedAvailable: true,
      }),
    ).toEqual({ ok: false, reason: "unknown_duration" });
  });

  it("blocks a 90-minute video on basic", () => {
    expect(
      evaluateGenerateGate({
        durationSeconds: 90 * 60,
        selectedTier: "basic",
        basicAvailable: true,
        advancedAvailable: true,
      }),
    ).toEqual({ ok: false, reason: "too_long" });
  });

  it("allows a 90-minute video on advanced", () => {
    expect(
      evaluateGenerateGate({
        durationSeconds: 90 * 60,
        selectedTier: "advanced",
        basicAvailable: true,
        advancedAvailable: true,
      }),
    ).toEqual({ ok: true });
  });

  it("needs advanced when the video exceeds basic and advanced is gone", () => {
    expect(
      evaluateGenerateGate({
        durationSeconds: 90 * 60,
        selectedTier: "basic",
        basicAvailable: true,
        advancedAvailable: false,
      }),
    ).toEqual({ ok: false, reason: "needs_advanced" });
  });

  it("blocks videos over the 2-hour advanced limit", () => {
    expect(
      evaluateGenerateGate({
        durationSeconds: 2 * 60 * 60 + 1,
        selectedTier: "advanced",
        basicAvailable: true,
        advancedAvailable: true,
      }),
    ).toEqual({ ok: false, reason: "too_long" });
  });
});
