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
              className="flex items-start gap-2 px-3 py-3 transition-colors hover:bg-muted/50 md:items-center md:gap-3 md:px-4 md:py-3.5"
            >
              <Link
                href={href}
                className="flex min-w-0 flex-1 cursor-pointer gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/50 md:gap-4"
                aria-label={t("openVideo", { title: item.title })}
              >
                <div className="w-[6.25rem] shrink-0 space-y-1 md:w-[7.5rem] md:space-y-0">
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt=""
                      width={120}
                      height={68}
                      className="h-14 w-full rounded-md bg-muted object-cover md:h-[4.25rem]"
                    />
                  ) : (
                    <div className="h-14 w-full rounded-md bg-muted md:h-[4.25rem]" />
                  )}
                  {item.channelTitle ? (
                    <p className="truncate text-sm font-medium leading-snug md:hidden">
                      {item.channelTitle}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5 py-0.5 md:space-y-2">
                  <div className="space-y-0.5">
                    <p className="line-clamp-2 font-medium leading-snug md:line-clamp-none md:truncate">
                      {item.title}
                    </p>
                    {item.channelTitle ? (
                      <p className="hidden truncate text-sm text-muted-foreground md:block">
                        {item.channelTitle}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:gap-2">
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
                      <span className="line-clamp-2 text-xs text-destructive/90 md:line-clamp-none md:truncate">
                        {item.errorMessage}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col items-end gap-1 self-stretch pt-0.5 md:flex-row md:items-center md:gap-3 md:self-center md:pt-0">
                <TimeAgo
                  date={item.refreshedAt}
                  className="order-2 pr-1.5 text-xs tabular-nums text-muted-foreground md:order-1 md:pr-0"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="order-1 text-muted-foreground md:order-2"
                      aria-label={t("moreActions", { title: item.title })}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onCloseAutoFocus={(event) => event.preventDefault()}
                  >
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
