"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";

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
      <header className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-3 sm:px-6">
        <Link
          href="/library"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("back")}
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-lg tracking-tight">
            {video.title}
          </h1>
          {video.channelTitle ? (
            <p className="truncate text-sm text-muted-foreground">
              {video.channelTitle}
            </p>
          ) : null}
        </div>
        <p
          aria-label={t("statusLabel")}
          className="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {statusT(phase)}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="border-b border-border sm:border-r sm:border-b-0">
          <WorkspacePlayer youtubeId={video.youtubeId} />
        </section>
        <aside className="min-h-0 overflow-y-auto">
          <WorkspacePane video={video} />
        </aside>
      </div>
    </main>
  );
}
