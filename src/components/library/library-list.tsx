import Image from "next/image";
import { getTranslations } from "next-intl/server";

import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";
import type { AnalysisStatus } from "@/db/schema";

type LibraryListProps = {
  items: LibraryListItem[];
};

function statusMessageKey(status: AnalysisStatus): string {
  switch (status) {
    case "pending":
    case "fetching_transcript":
      return "status.fetching";
    case "analyzing":
    case "awaiting_context":
    case "generating_summary":
      return "status.analyzing";
    case "complete":
      return "status.complete";
    case "failed":
      return "status.failed";
    default:
      return "status.analyzing";
  }
}

export async function LibraryList({ items }: LibraryListProps) {
  const t = await getTranslations("Library");

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <p className="text-muted-foreground">{t("empty")}</p>
      </section>
    );
  }

  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li
          key={item.userVideoId}
          className="flex gap-4 py-4 first:pt-0 last:pb-0"
        >
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt=""
              width={112}
              height={64}
              className="h-16 w-28 shrink-0 rounded-md object-cover bg-muted"
            />
          ) : (
            <div className="h-16 w-28 shrink-0 rounded-md bg-muted" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-medium leading-snug">{item.title}</p>
            {item.channelTitle ? (
              <p className="truncate text-sm text-muted-foreground">
                {item.channelTitle}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {t(statusMessageKey(item.status))}
              {item.status === "failed" && item.errorMessage
                ? ` — ${item.errorMessage}`
                : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
