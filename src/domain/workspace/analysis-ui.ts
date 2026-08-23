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

export const PANE_KINDS = [
  "progress",
  "failed",
  "awaiting",
  "complete",
] as const;

export type PaneKind = (typeof PANE_KINDS)[number];

export const CHECKLIST_STEP_IDS = [
  "found",
  "transcript",
  "understanding",
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
    case "classifying":
      return "understanding";
    case "generating":
      return "generating";
    case "awaiting":
      return "awaiting";
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
    case "awaiting":
      return "awaiting";
    case "complete":
      return "complete";
    case "pending":
    case "fetching":
    case "classifying":
    case "generating":
      return "progress";
  }
}

export function shouldPoll(status: AnalysisStatus): boolean {
  return (
    status === "pending" ||
    status === "fetching" ||
    status === "classifying" ||
    status === "generating"
  );
}

export function isFailedStatus(status: AnalysisStatus): boolean {
  return status === "failed";
}

function steps(
  transcript: ChecklistStepState,
  understanding: ChecklistStepState,
  summary: ChecklistStepState,
): ChecklistStep[] {
  return [
    { id: "found", state: "done" },
    { id: "transcript", state: transcript },
    { id: "understanding", state: understanding },
    { id: "summary", state: summary },
  ];
}

export function analysisChecklist(status: AnalysisStatus): ChecklistStep[] {
  switch (status) {
    case "pending":
    case "fetching":
      return steps("current", "upcoming", "upcoming");
    case "classifying":
      return steps("done", "current", "upcoming");
    case "awaiting":
      return steps("done", "done", "upcoming");
    case "generating":
      return steps("done", "done", "current");
    case "complete":
      return steps("done", "done", "done");
    case "failed":
      return steps("upcoming", "upcoming", "upcoming");
  }
}
