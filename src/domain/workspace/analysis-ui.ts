import type { AnalysisStatus } from "@/db/schema";

export const ANALYSIS_UI_PHASES = [
  "fetching",
  "understanding",
  "generating",
  "awaiting",
  "complete",
  "failed",
] as const;

export type AnalysisUiPhase = (typeof ANALYSIS_UI_PHASES)[number];

export function analysisUiPhase(status: AnalysisStatus): AnalysisUiPhase {
  switch (status) {
    case "pending":
    case "fetching_transcript":
      return "fetching";
    case "analyzing":
      return "understanding";
    case "generating_summary":
      return "generating";
    case "awaiting_context":
      return "awaiting";
    case "complete":
      return "complete";
    case "failed":
      return "failed";
  }
}

export function isFailedStatus(status: AnalysisStatus): boolean {
  return status === "failed";
}
