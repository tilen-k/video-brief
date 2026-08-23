import { Play } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  SyncRail,
  type SyncSection,
} from "@/components/shared/sync/sync-rail";
import { SyncTimestamp } from "@/components/shared/sync/sync-timestamp";
import { Panel } from "@/components/shared/list/panel";

const SECTION_KEYS = ["s1", "s2", "s3"] as const;
const ACTIVE_INDEX = 1;

export async function SyncPreview() {
  const t = await getTranslations("Landing");

  const sections = SECTION_KEYS.map((key) =>
    t.raw(`previewSections.${key}`),
  ) as SyncSection[];

  return (
    <figure
      aria-label={t("previewLabel")}
      className="landing-preview-enter w-full max-w-xl"
    >
      <SyncTimestamp variant="caption" className="mb-3 block text-annotation">
        {t("previewLabel")}
      </SyncTimestamp>

      <Panel padding="none">
        <div className="grid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="border-b border-border sm:border-r sm:border-b-0">
            <div className="relative aspect-video bg-muted/50">
              <div className="absolute inset-0 bg-[linear-gradient(155deg,oklch(0.24_0.025_260)_0%,oklch(0.17_0.02_260)_100%)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-10 items-center justify-center rounded-full border border-foreground/15 bg-background/15 backdrop-blur-sm">
                  <Play
                    className="ml-0.5 size-4 fill-foreground/85 text-foreground/85"
                    aria-hidden
                  />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-3 pt-10">
                <p className="truncate text-xs text-white/90">
                  {t("previewVideoTitle")}
                </p>
                <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[38%] rounded-full bg-sync" />
                </div>
                <SyncTimestamp variant="compact" className="mt-1 text-white/55">
                  4:12 / 11:04
                </SyncTimestamp>
              </div>
            </div>
          </div>

          <div className="px-3 py-3">
            <SyncRail
              sections={sections}
              activeIndex={ACTIVE_INDEX}
              activeLabel={t("previewActive")}
              compact
            />
          </div>
        </div>
      </Panel>
    </figure>
  );
}
