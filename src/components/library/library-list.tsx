"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircleIcon,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AnalysisStatusBadge } from "@/components/shared/status/analysis-status-badge";
import { EmptyState } from "@/components/shared/list/empty-state";
import { Panel } from "@/components/shared/list/panel";
import { TimeAgo } from "@/components/shared/time-ago";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";
import {
  analysisUiPhase,
  isFailedStatus,
} from "@/domain/workspace/analysis-ui";
import { useLibraryStatus } from "@/hooks/use-library-status";
import { softDeleteLibraryVideo } from "@/lib/actions/library";

type LibraryListProps = {
  initialItems: LibraryListItem[];
  onRefresh: (item: LibraryListItem) => void;
};

type PendingDelete = {
  userVideoId: string;
  title: string;
};

export function LibraryList({ initialItems, onRefresh }: LibraryListProps) {
  const t = useTranslations("Library");
  const statusT = useTranslations("AnalysisStatus");
  const items = useLibraryStatus(initialItems);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    const { userVideoId } = pendingDelete;
    setDeleteError(null);
    startDelete(async () => {
      const result = await softDeleteLibraryVideo({ userVideoId });
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      queryClient.setQueryData<LibraryListItem[]>(["library"], (prev) =>
        (prev ?? items).filter((row) => row.userVideoId !== userVideoId),
      );
      setPendingDelete(null);
      setDeleteError(null);
      router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          {t("yourVideos")}
        </h2>
        <EmptyState>{t("empty")}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">{t("yourVideos")}</h2>
      {deleteError && !pendingDelete ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("deleteErrorTitle")}</AlertTitle>
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      ) : null}
      <Panel padding="none" className="divide-y divide-border/80">
        {items.map((item) => {
          const failed = isFailedStatus(item.status);
          const phase = analysisUiPhase(item.status);
          const href = `/v/${item.userVideoId}`;

          return (
            <div
              key={item.userVideoId}
              className="flex items-center gap-2 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:gap-3"
            >
              <Link
                href={href}
                className="flex min-w-0 flex-1 cursor-pointer gap-4 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/50"
                aria-label={t("openVideo", { title: item.title })}
              >
                {item.thumbnailUrl ? (
                  <Image
                    src={item.thumbnailUrl}
                    alt=""
                    width={120}
                    height={68}
                    className="h-[4.25rem] w-[7.5rem] shrink-0 rounded-md bg-muted object-cover"
                  />
                ) : (
                  <div className="h-[4.25rem] w-[7.5rem] shrink-0 rounded-md bg-muted" />
                )}

                <div className="min-w-0 flex-1 space-y-2 py-0.5">
                  <div className="space-y-0.5">
                    <p className="truncate font-medium leading-snug">
                      {item.title}
                    </p>
                    {item.channelTitle ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {item.channelTitle}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <AnalysisStatusBadge
                      status={item.status}
                      label={statusT(phase)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.modelTier === "advanced"
                        ? t("modelTierAdvanced")
                        : t("modelTierBasic")}
                    </span>
                    {failed && item.errorMessage ? (
                      <span className="truncate text-xs text-destructive/90">
                        {item.errorMessage}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-3 self-center">
                <TimeAgo
                  date={item.refreshedAt}
                  className="text-xs tabular-nums text-muted-foreground"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      aria-label={t("moreActions", { title: item.title })}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onRefresh(item)}>
                      <RefreshCw className="size-4" />
                      {t("generateAgain")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deletePending}
                      onClick={() =>
                        setPendingDelete({
                          userVideoId: item.userVideoId,
                          title: item.title,
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                      {t("removeVideo")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </Panel>

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deletePending) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        title={t("deleteDialogTitle")}
        description={
          pendingDelete
            ? t("deleteDialogBody", { title: pendingDelete.title })
            : ""
        }
        confirmLabel={t("deleteDialogConfirm")}
        cancelLabel={t("deleteDialogCancel")}
        onConfirm={confirmDelete}
        confirmPending={deletePending}
        destructive
        error={deleteError}
      />
    </section>
  );
}
