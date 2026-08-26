"use client";

import { useCallback, useRef, useState } from "react";

import { showFamiliaritySlider } from "@/domain/analysis/familiarity-categories";
import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";
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
};

export function LibraryComposer({
  initialItems,
  defaultLength,
  defaultTone,
}: LibraryComposerProps) {
  const [configure, setConfigure] = useState<ConfigureState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handlePreview = useCallback(
    (preview: VideoConfigurationPreview) => {
      setConfigure({
        source: "preview",
        preview,
        defaults: {
          summaryLength: defaultLength,
          summaryTone: defaultTone,
          familiarity: preview.showFamiliarity ? 50 : null,
        },
      });
    },
    [defaultLength, defaultTone],
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
        familiarity: showFamiliarity ? (item.familiarity ?? 50) : null,
      },
    });
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const clearConfigure = useCallback(() => {
    setConfigure(null);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div ref={panelRef}>
        <Panel>
          <AddVideoForm onPreview={handlePreview} />
          {configure ? (
            <VideoConfiguration
              preview={configure.preview}
              defaults={configure.defaults}
              onClear={clearConfigure}
            />
          ) : null}
        </Panel>
      </div>

      <LibraryList initialItems={initialItems} onRefresh={handleRefresh} />
    </div>
  );
}
