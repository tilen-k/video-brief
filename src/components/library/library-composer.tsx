"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
import { Panel } from "@/components/shared/list/panel";

import { AddVideoForm } from "./add-video-form";
import { LibraryList } from "./library-list";
import {
  VideoConfiguration,
  type VideoConfigurationDefaults,
  type VideoConfigurationPreview,
} from "./video-configuration";

type ConfigureState = {
  formKey: string;
  preview: VideoConfigurationPreview | null;
  previewLoading: boolean;
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
};

function profileDefaults(
  defaultLength: number,
  defaultTone: number,
  defaultSummaryLanguage: string,
  modelTier: VideoConfigurationDefaults["modelTier"],
): VideoConfigurationDefaults {
  return {
    summaryLength: defaultLength,
    summaryTone: defaultTone,
    summaryLanguage: defaultSummaryLanguage,
    familiarity: null,
    modelTier,
  };
}

export function LibraryComposer({
  initialItems,
  defaultLength,
  defaultTone,
  defaultSummaryLanguage,
  plan,
  advancedModelEnabled,
  usageTiers,
}: LibraryComposerProps) {
  const t = useTranslations("Library");
  const [configure, setConfigure] = useState<ConfigureState | null>(null);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const sessionRef = useRef(0);
  const configurePanelRef = useRef<HTMLDivElement>(null);
  const scrollConfigureIntoViewRef = useRef(false);

  useLayoutEffect(() => {
    if (!scrollConfigureIntoViewRef.current) {
      return;
    }
    scrollConfigureIntoViewRef.current = false;
    const panel = configurePanelRef.current;
    if (!panel) {
      return;
    }
    const header = document.querySelector("header");
    const offset = header?.getBoundingClientRect().height ?? 0;
    const top = window.scrollY + panel.getBoundingClientRect().top - offset;
    window.scrollTo(0, Math.max(0, top));
  }, [configure]);

  const defaultModelTier = preferredModelTierFromUsage(
    advancedModelEnabled,
    usageTiers.advanced,
  );

  const nextFormKey = useCallback(() => {
    sessionRef.current += 1;
    return `configure-${sessionRef.current}`;
  }, []);

  const handlePreviewStart = useCallback(() => {
    setConfigure((prev) => {
      if (prev) {
        return { ...prev, preview: null, previewLoading: true };
      }
      return {
        formKey: nextFormKey(),
        preview: null,
        previewLoading: true,
        defaults: profileDefaults(
          defaultLength,
          defaultTone,
          defaultSummaryLanguage,
          defaultModelTier,
        ),
      };
    });
  }, [
    defaultLength,
    defaultTone,
    defaultSummaryLanguage,
    defaultModelTier,
    nextFormKey,
  ]);

  const handlePreview = useCallback(
    (preview: VideoConfigurationPreview) => {
      setConfigure((prev) => {
        // Cancelled while in flight — ignore late result.
        if (prev == null) {
          return null;
        }
        return {
          ...prev,
          preview,
          previewLoading: false,
          defaults: {
            ...prev.defaults,
            familiarity: preview.showFamiliarity
              ? (prev.defaults.familiarity ?? 50)
              : null,
          },
        };
      });
    },
    [],
  );

  const handlePreviewError = useCallback(() => {
    setConfigure((prev) =>
      prev ? { ...prev, preview: null, previewLoading: false } : null,
    );
  }, []);

  const handleRefresh = useCallback(
    (item: LibraryListItem) => {
      const showFamiliarity = showFamiliaritySlider(item.youtubeCategoryId);
      const preferredTier = isAdvancedTierAvailable(
        advancedModelEnabled,
        usageTiers.advanced,
      )
        ? resolveModelTier(plan, item.modelTier)
        : "basic";
      setPreviewEpoch((value) => value + 1);
      scrollConfigureIntoViewRef.current = true;
      setConfigure({
        formKey: nextFormKey(),
        previewLoading: false,
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
    },
    [advancedModelEnabled, plan, usageTiers.advanced, nextFormKey],
  );

  const dismissConfigure = useCallback(() => {
    setPreviewEpoch((value) => value + 1);
    setConfigure(null);
  }, []);

  const patchDefaults = useCallback(
    (patch: Partial<VideoConfigurationDefaults>) => {
      setConfigure((prev) =>
        prev
          ? { ...prev, defaults: { ...prev.defaults, ...patch } }
          : prev,
      );
    },
    [],
  );

  return (
    <div className="flex flex-col gap-8 overflow-anchor-none">
      <div className="flex flex-col gap-4">
        <Panel>
          <div className="flex flex-col gap-5">
            <h2 className="font-heading text-base tracking-tight">
              {t("addTitle")}
            </h2>
            <AddVideoForm
              epoch={previewEpoch}
              onPreview={handlePreview}
              onPreviewStart={handlePreviewStart}
              onPreviewError={handlePreviewError}
            />
          </div>
        </Panel>

        {configure ? (
          <div ref={configurePanelRef}>
            <Panel>
              <VideoConfiguration
                preview={configure.preview}
                previewLoading={configure.previewLoading}
                defaults={configure.defaults}
                plan={plan}
                advancedModelEnabled={advancedModelEnabled}
                usageTiers={usageTiers}
                formKey={configure.formKey}
                onDefaultsChange={patchDefaults}
                onClear={dismissConfigure}
              />
            </Panel>
          </div>
        ) : null}
      </div>

      <LibraryList initialItems={initialItems} onRefresh={handleRefresh} />
    </div>
  );
}
