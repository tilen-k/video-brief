"use client";

import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AnalysisChecklist } from "@/components/shared/status/analysis-checklist";
import { EmptyState } from "@/components/shared/list/empty-state";
import { Panel } from "@/components/shared/list/panel";
import {
  analysisChecklist,
  paneKind,
} from "@/domain/workspace/analysis-ui";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type WorkspacePaneProps = {
  video: WorkspaceVideo;
};

export function WorkspacePane({ video }: WorkspacePaneProps) {
  const t = useTranslations("Workspace");
  const checklistT = useTranslations("Workspace.checklist");
  const kind = paneKind(video.status);

  if (kind === "failed") {
    return (
      <Panel>
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("failedTitle")}</AlertTitle>
          <AlertDescription>
            {video.errorMessage ?? t("failedFallback")}
            <p className="mt-3 text-muted-foreground">{t("failedHint")}</p>
          </AlertDescription>
        </Alert>
      </Panel>
    );
  }

  if (kind === "awaiting") {
    return <EmptyState>{t("awaitingPlaceholder")}</EmptyState>;
  }

  if (kind === "complete") {
    return <EmptyState>{t("completePlaceholder")}</EmptyState>;
  }

  return (
    <AnalysisChecklist
      steps={analysisChecklist(video.status)}
      getLabel={(stepId) => checklistT(stepId)}
      ariaLabel={t("checklistLabel")}
    />
  );
}
