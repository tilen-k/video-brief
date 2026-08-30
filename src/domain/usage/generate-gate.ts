import type { ModelTier } from "@/db/schema";

import { durationExceedsTier } from "./duration";

export type GenerateGateReason =
  | "both_exhausted"
  | "selected_exhausted"
  | "too_long"
  | "needs_advanced"
  | "unknown_duration";

export type GenerateGate =
  | { ok: true }
  | { ok: false; reason: GenerateGateReason };

export function evaluateGenerateGate(input: {
  durationSeconds: number | null;
  selectedTier: ModelTier;
  basicAvailable: boolean;
  advancedAvailable: boolean;
}): GenerateGate {
  const { durationSeconds, selectedTier, basicAvailable, advancedAvailable } =
    input;

  if (!basicAvailable && !advancedAvailable) {
    return { ok: false, reason: "both_exhausted" };
  }

  if (selectedTier === "basic" && !basicAvailable) {
    return { ok: false, reason: "selected_exhausted" };
  }
  if (selectedTier === "advanced" && !advancedAvailable) {
    return { ok: false, reason: "selected_exhausted" };
  }

  if (durationSeconds == null) {
    return { ok: false, reason: "unknown_duration" };
  }

  const exceedsAdvanced = durationExceedsTier("advanced", durationSeconds);
  const exceedsBasic = durationExceedsTier("basic", durationSeconds);
  const exceedsSelected = durationExceedsTier(selectedTier, durationSeconds);

  if (exceedsAdvanced) {
    return { ok: false, reason: "too_long" };
  }

  if (exceedsSelected) {
    if (selectedTier === "basic" && exceedsBasic && !advancedAvailable) {
      return { ok: false, reason: "needs_advanced" };
    }
    return { ok: false, reason: "too_long" };
  }

  return { ok: true };
}
