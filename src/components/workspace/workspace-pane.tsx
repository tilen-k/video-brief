"use client";

import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  analysisChecklist,
  paneKind,
  type ChecklistStep,
} from "@/domain/workspace/analysis-ui";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type WorkspacePaneProps = {
  video: WorkspaceVideo;
};

export function WorkspacePane({ video }: WorkspacePaneProps) {
  const t = useTranslations("Workspace");
  const kind = paneKind(video.status);

  if (kind === "failed") {
    return (
      <div className="px-5 py-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("failedTitle")}</AlertTitle>
          <AlertDescription>
            {video.errorMessage ?? t("failedFallback")}
            <p className="mt-3">{t("failedHint")}</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (kind === "awaiting") {
    return (
      <p className="px-5 py-8 text-sm text-muted-foreground">
        {t("awaitingPlaceholder")}
      </p>
    );
  }

  if (kind === "complete") {
    return (
      <p className="px-5 py-8 text-sm text-muted-foreground">
        {t("completePlaceholder")}
      </p>
    );
  }

  return <WorkspaceChecklist steps={analysisChecklist(video.status)} />;
}

function WorkspaceChecklist({ steps }: { steps: ChecklistStep[] }) {
  const t = useTranslations("Workspace.checklist");

  return (
    <ol className="relative flex flex-col py-4">
      <div
        aria-hidden
        className="absolute bottom-6 left-5 top-6 w-px bg-border"
      />
      {steps.map((step) => {
        const isCurrent = step.state === "current";
        const isDone = step.state === "done";

        return (
          <li
            key={step.id}
            className={cn(
              "relative pl-10 pr-5 py-2.5",
              isCurrent && "border-l-2 border-primary bg-primary/8",
              !isCurrent && "text-muted-foreground",
            )}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full",
                isCurrent &&
                  "left-[15px] size-2 bg-primary ring-2 ring-background",
                isDone && "left-4 size-1.5 bg-primary/70",
                step.state === "upcoming" && "left-4 size-1.5 bg-border",
              )}
            />
            <p
              className={cn(
                "text-sm leading-snug",
                isCurrent && "text-foreground",
                isDone && "text-foreground/80",
              )}
            >
              {t(step.id)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
