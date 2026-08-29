"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { showFamiliaritySlider } from "@/domain/analysis/familiarity-categories";
import {
  isAdvancedTierAvailable,
  preferredModelTierFromUsage,
  resolveModelTier,
} from "@/domain/analysis/model-tier";
import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";
import type { PlanId } from "@/db/schema";
import type { TierUsage } from "@/domain/usage";
import { LoadingPanel } from "@/components/shared/status/loading-dots";
import { Panel } from "@/components/shared/list/panel";

import { AddVideoForm } from "./add-video-form";
import { LibraryList } from "./library-list";
import {
  VideoConfiguration,
  type VideoConfigurationDefaults,
  type VideoConfigurationPreview,
} from "./video-configuration";

type ConfigureState = {
  source: "preview" | "refresh";
  preview: VideoConfigurationPreview;
  defaults: VideoConfigurationDefaults;
};

type UsageTiers = {
  basic: TierUsage;
  advanced: TierUsage;
};

type LibraryComposerProps = {
  initialItems: LibraryListItem[];
  defaultLength: number;
  defaultTone: number;
  defaultSummaryLanguage: string;
  plan: PlanId;
  advancedModelEnabled: boolean;
  usageTiers: UsageTiers;
  isGuest: boolean;
};

export function LibraryComposer({
  initialItems,
  defaultLength,
  defaultTone,
  defaultSummaryLanguage,
  plan,
  advancedModelEnabled,
  usageTiers,
  isGuest,
}: LibraryComposerProps) {
  const t = useTranslations("Library");
  const [configure, setConfigure] = useState<ConfigureState | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [pasteFormKey, setPasteFormKey] = useState(0);
  const composerRef = useRef<HTMLDivElement>(null);

  const defaultModelTier = preferredModelTierFromUsage(
    advancedModelEnabled,
    usageTiers.advanced,
  );

  const handlePreview = useCallback(
    (preview: VideoConfigurationPreview) => {
      setConfigure({
        source: "preview",
        preview,
        defaults: {
          summaryLength: defaultLength,
          summaryTone: defaultTone,
          summaryLanguage: defaultSummaryLanguage,
          familiarity: preview.showFamiliarity ? 50 : null,
          modelTier: defaultModelTier,
        },
      });
    },
    [
      defaultLength,
      defaultTone,
      defaultSummaryLanguage,
      defaultModelTier,
    ],
  );

  const handleRefresh = useCallback(
    (item: LibraryListItem) => {
      const showFamiliarity = showFamiliaritySlider(item.youtubeCategoryId);
      const preferredTier = isAdvancedTierAvailable(
        advancedModelEnabled,
        usageTiers.advanced,
      )
        ? resolveModelTier(plan, item.modelTier)
        : "basic";
      setConfigure({
        source: "refresh",
        preview: {
          youtubeId: item.youtubeId,
          title: item.title,
          channelTitle: item.channelTitle,
          thumbnailUrl: item.thumbnailUrl,
          durationSeconds: item.durationSeconds,
          youtubeCategoryId: item.youtubeCategoryId,
          showFamiliarity,
        },
        defaults: {
          summaryLength: item.summaryLength,
          summaryTone: item.summaryTone,
          summaryLanguage: item.summaryLanguage,
          familiarity: showFamiliarity ? (item.familiarity ?? 50) : null,
          modelTier: preferredTier,
        },
      });
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [advancedModelEnabled, plan, usageTiers.advanced],
  );

  const clearConfigure = useCallback(() => {
    setConfigure(null);
  }, []);

  const dismissConfigure = useCallback(() => {
    setConfigure(null);
    setPasteFormKey((value) => value + 1);
  }, []);

  const handlePreviewPendingChange = useCallback((pending: boolean) => {
    setPreviewPending(pending);
    if (pending) {
      setConfigure(null);
    }
  }, []);

  return (
    <div ref={composerRef} className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Panel>
          <div className="flex flex-col gap-5">
            <h2 className="font-heading text-base tracking-tight">
              {t("addTitle")}
            </h2>
            <AddVideoForm
              key={pasteFormKey}
              onPreview={handlePreview}
              onClearPreview={clearConfigure}
              onPreviewPendingChange={handlePreviewPendingChange}
            />
          </div>
        </Panel>

        {previewPending ? (
          <Panel>
            <LoadingPanel label={t("previewing")} />
          </Panel>
        ) : null}

        {!previewPending && configure ? (
          <Panel>
            <VideoConfiguration
              preview={configure.preview}
              defaults={configure.defaults}
              plan={plan}
              advancedModelEnabled={advancedModelEnabled}
              usageTiers={usageTiers}
              isGuest={isGuest}
              onClear={dismissConfigure}
            />
          </Panel>
        ) : null}
      </div>

      <LibraryList initialItems={initialItems} onRefresh={handleRefresh} />
    </div>
  );
}
