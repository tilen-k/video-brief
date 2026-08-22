import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { analysisUiPhase } from "@/domain/workspace/analysis-ui";
import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";

type LibraryListProps = {
  items: LibraryListItem[];
};

export async function LibraryList({ items }: LibraryListProps) {
  const t = await getTranslations("Library");
  const statusT = await getTranslations("AnalysisStatus");

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
        <li key={item.userVideoId}>
          <Link
            href={`/library/${item.userVideoId}`}
            className="flex gap-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("openVideo", { title: item.title })}
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
                {statusT(analysisUiPhase(item.status))}
                {item.status === "failed" && item.errorMessage
                  ? ` — ${item.errorMessage}`
                  : null}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
