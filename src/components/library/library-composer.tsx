"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { showFamiliaritySlider } from "@/domain/analysis/familiarity-categories";
import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";
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

type LibraryComposerProps = {
  initialItems: LibraryListItem[];
  defaultLength: number;
  defaultTone: number;
  defaultSummaryLanguage: string;
};

export function LibraryComposer({
  initialItems,
  defaultLength,
  defaultTone,
  defaultSummaryLanguage,
}: LibraryComposerProps) {
  const t = useTranslations("Library");
  const [configure, setConfigure] = useState<ConfigureState | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [pasteFormKey, setPasteFormKey] = useState(0);
  const composerRef = useRef<HTMLDivElement>(null);

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
        },
      });
    },
    [defaultLength, defaultTone, defaultSummaryLanguage],
  );

  const handleRefresh = useCallback((item: LibraryListItem) => {
    const showFamiliarity = showFamiliaritySlider(item.youtubeCategoryId);
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
      },
    });
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
            <div className="space-y-1">
              <h2 className="font-heading text-base tracking-tight">
                {t("addTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("pasteHint")}</p>
            </div>
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
              onClear={dismissConfigure}
            />
          </Panel>
        ) : null}
      </div>

      <LibraryList initialItems={initialItems} onRefresh={handleRefresh} />
    </div>
  );
}
