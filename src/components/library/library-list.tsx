import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { AnalysisStatusBadge } from "@/components/shared/status/analysis-status-badge";
import { EmptyState } from "@/components/shared/list/empty-state";
import { ListRowLink } from "@/components/shared/list/list-row-link";
import { Panel } from "@/components/shared/list/panel";
import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";
import {
  analysisUiPhase,
  isFailedStatus,
} from "@/domain/workspace/analysis-ui";

type LibraryListProps = {
  items: LibraryListItem[];
};

export async function LibraryList({ items }: LibraryListProps) {
  const t = await getTranslations("Library");
  const statusT = await getTranslations("AnalysisStatus");

  if (items.length === 0) {
    return <EmptyState>{t("empty")}</EmptyState>;
  }

  return (
    <Panel padding="none" className="divide-y divide-border/80">
      {items.map((item) => {
        const failed = isFailedStatus(item.status);
        const phase = analysisUiPhase(item.status);

        return (
          <ListRowLink
            key={item.userVideoId}
            href={failed ? undefined : `/library/${item.userVideoId}`}
            disabled={failed}
            aria-label={t("openVideo", { title: item.title })}
          >
            {item.thumbnailUrl ? (
              <Image
                src={item.thumbnailUrl}
                alt=""
                width={120}
                height={68}
                className="h-[4.25rem] w-[7.5rem] shrink-0 rounded-md object-cover bg-muted"
              />
            ) : (
              <div className="h-[4.25rem] w-[7.5rem] shrink-0 rounded-md bg-muted" />
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div className="space-y-0.5">
                <p className="truncate font-medium leading-snug">{item.title}</p>
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
                {failed && item.errorMessage ? (
                  <span className="truncate text-xs text-destructive/90">
                    {item.errorMessage}
                  </span>
                ) : null}
              </div>
            </div>
          </ListRowLink>
        );
      })}
    </Panel>
  );
}
