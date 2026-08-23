"use client";

import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { AnalysisStatusBadge } from "@/components/shared/status/analysis-status-badge";
import { ThemeToggle } from "@/components/shared/layout/theme-toggle";
import { analysisUiPhase } from "@/domain/workspace/analysis-ui";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import { useWorkspaceStatus } from "@/hooks/use-workspace-status";

import { WorkspacePane } from "./workspace-pane";

const WorkspacePlayer = dynamic(
  () => import("./workspace-player").then((mod) => mod.WorkspacePlayer),
  {
    ssr: false,
    loading: () => <div className="aspect-video w-full bg-muted" />,
  },
);

type WorkspaceShellProps = {
  initial: WorkspaceVideo;
};

export function WorkspaceShell({ initial }: WorkspaceShellProps) {
  const video = useWorkspaceStatus(initial);
  const t = useTranslations("Workspace");
  const statusT = useTranslations("AnalysisStatus");
  const phase = analysisUiPhase(video.status);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <Link
            href="/library"
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

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="border-b border-border lg:border-r lg:border-b-0">
          <WorkspacePlayer youtubeId={video.youtubeId} />
        </section>
        <aside className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <WorkspacePane video={video} />
        </aside>
      </div>
    </main>
  );
}
