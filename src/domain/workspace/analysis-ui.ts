import type { AnalysisStatus } from "@/db/schema";

export const ANALYSIS_UI_PHASES = [
  "fetching",
  "generating",
  "complete",
  "failed",
] as const;

export type AnalysisUiPhase = (typeof ANALYSIS_UI_PHASES)[number];

export const PANE_KINDS = [
  "progress",
  "failed",
  "complete",
] as const;

export type PaneKind = (typeof PANE_KINDS)[number];

export const CHECKLIST_STEP_IDS = [
  "found",
  "transcript",
  "summary",
] as const;

export type ChecklistStepId = (typeof CHECKLIST_STEP_IDS)[number];

export type ChecklistStepState = "done" | "current" | "upcoming";

export type ChecklistStep = {
  id: ChecklistStepId;
  state: ChecklistStepState;
};

export function analysisUiPhase(status: AnalysisStatus): AnalysisUiPhase {
  switch (status) {
    case "pending":
    case "fetching":
      return "fetching";
    case "generating":
      return "generating";
    case "complete":
      return "complete";
    case "failed":
      return "failed";
  }
}

export function paneKind(status: AnalysisStatus): PaneKind {
  switch (status) {
    case "failed":
      return "failed";
    case "complete":
      return "complete";
    case "pending":
    case "fetching":
    case "generating":
      return "progress";
  }
}

export function shouldPoll(status: AnalysisStatus): boolean {
  return (
    status === "pending" ||
    status === "fetching" ||
    status === "generating"
  );
}

export function isFailedStatus(status: AnalysisStatus): boolean {
  return status === "failed";
}

function steps(
  transcript: ChecklistStepState,
  summary: ChecklistStepState,
): ChecklistStep[] {
  return [
    { id: "found", state: "done" },
    { id: "transcript", state: transcript },
    { id: "summary", state: summary },
  ];
}

export function analysisChecklist(status: AnalysisStatus): ChecklistStep[] {
  switch (status) {
    case "pending":
    case "fetching":
      return steps("current", "upcoming");
    case "generating":
      return steps("done", "current");
    case "complete":
      return steps("done", "done");
    case "failed":
      return steps("upcoming", "upcoming");
  }
}
