"use client";

import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { AnalysisStatusBadge } from "@/components/shared/status/analysis-status-badge";
import { ThemeToggle } from "@/components/shared/layout/theme-toggle";
import { analysisUiPhase, paneKind } from "@/domain/workspace/analysis-ui";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import { usePlayerSync } from "@/hooks/use-player-sync";
import { useWorkspaceStatus } from "@/hooks/use-workspace-status";

import { WorkspacePane } from "./workspace-pane";
import { WorkspaceSections } from "./workspace-sections";
import { WorkspaceSummary } from "./workspace-summary";

const WorkspacePlayer = dynamic(
  () => import("./workspace-player").then((mod) => mod.WorkspacePlayer),
  {
    ssr: false,
    loading: () => <div className="aspect-video w-full bg-muted" />,
  },
);

type WorkspaceShellProps = {
  initial: WorkspaceVideo;
  notice?: string;
};

export function WorkspaceShell({ initial, notice }: WorkspaceShellProps) {
  const video = useWorkspaceStatus(initial);
  const { currentTime, onReady, seekTo } = usePlayerSync();
  const t = useTranslations("Workspace");
  const statusT = useTranslations("AnalysisStatus");
  const phase = analysisUiPhase(video.status);
  const kind = paneKind(video.status);

  return (
    <main className="flex min-h-full flex-1 flex-col lg:h-dvh lg:max-h-dvh lg:overflow-hidden">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            {t("back")}
          </Link>

          <div className="min-w-0 flex-1 border-l border-border pl-3 sm:pl-4">
            <h1 className="truncate font-heading text-base tracking-tight sm:text-lg">
              {video.title}
            </h1>
            {video.channelTitle ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {video.channelTitle}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <AnalysisStatusBadge
              status={video.status}
              label={statusT(phase)}
            />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {notice === "model_fallback" ? (
        <p
          className="shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-center text-sm text-muted-foreground sm:px-6"
          role="status"
        >
          {t("modelFallbackNotice")}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:h-full lg:min-h-0 lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="order-1 mx-auto w-full max-w-3xl px-4 sm:px-6 lg:col-start-1 lg:row-start-1 lg:border-r lg:border-border lg:px-6">
          <WorkspacePlayer youtubeId={video.youtubeId} onReady={onReady} />
        </div>
        <aside className="order-2 min-h-0 overflow-y-auto border-b border-border p-4 sm:p-6 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-b-0">
          {kind === "complete" ? (
            <WorkspaceSummary
              title={t("summaryLabel")}
              body={video.summary}
              emptyLabel={t("summaryEmpty")}
            />
          ) : (
            <WorkspacePane video={video} />
          )}
        </aside>
        {kind === "complete" ? (
          <div className="order-3 min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:col-start-1 lg:row-start-2 lg:border-r lg:border-border">
            <WorkspaceSections
              sections={video.sections}
              emptyLabel={t("completePlaceholder")}
              listLabel={t("sectionsLabel")}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
