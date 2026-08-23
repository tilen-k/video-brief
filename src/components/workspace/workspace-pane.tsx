"use client";

import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AnalysisChecklist } from "@/components/shared/status/analysis-checklist";
import { Panel } from "@/components/shared/list/panel";
import {
  analysisChecklist,
  paneKind,
} from "@/domain/workspace/analysis-ui";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { VideoPrefsForm } from "./video-prefs-form";
import { WorkspaceSections } from "./workspace-sections";

type WorkspacePaneProps = {
  video: WorkspaceVideo;
  currentTime: number;
  onSeek: (startTime: number) => void;
};

export function WorkspacePane({
  video,
  currentTime,
  onSeek,
}: WorkspacePaneProps) {
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
    return <VideoPrefsForm video={video} />;
  }

  if (kind === "complete") {
    return (
      <div className="flex flex-col gap-4">
        {video.classification && !video.classification.isEducational ? (
          <p className="text-sm text-muted-foreground">{t("nonEduDisclaimer")}</p>
        ) : null}
        <WorkspaceSections
          sections={video.sections}
          emptyLabel={t("completePlaceholder")}
          listLabel={t("sectionsLabel")}
          currentTime={currentTime}
          onSeek={onSeek}
        />
      </div>
    );
  }

  return (
    <AnalysisChecklist
      steps={analysisChecklist(video.status)}
      getLabel={(stepId) => checklistT(stepId)}
      ariaLabel={t("checklistLabel")}
    />
  );
}
