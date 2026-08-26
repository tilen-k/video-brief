"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import {
  SyncRail,
  type SyncSection,
} from "@/components/shared/sync/sync-rail";
import { SyncTimestamp } from "@/components/shared/sync/sync-timestamp";

const SECTION_KEYS = ["s1", "s2", "s3"] as const;
const CYCLE_MS = 3200;

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function AuthBrandPanel() {
  const t = useTranslations("Auth");
  const [activeIndex, setActiveIndex] = useState(1);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const sections = useMemo<SyncSection[]>(
    () =>
      SECTION_KEYS.map((key) => {
        const section = t.raw(`previewSections.${key}`) as SyncSection;
        return section;
      }),
    [t],
  );

  useEffect(() => {
    if (reducedMotion) return;

    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % sections.length);
    }, CYCLE_MS);

    return () => window.clearInterval(id);
  }, [reducedMotion, sections.length]);

  return (
    <div className="flex h-full flex-col justify-between bg-muted/30 p-8 lg:p-10">
      <div>
        <SyncTimestamp className="text-sync">4:12 / 11:04</SyncTimestamp>
        <h2 className="mt-3 max-w-xs font-heading text-2xl leading-tight tracking-tight">
          {t("previewVideoTitle")}
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {t("previewSubtitle")}
        </p>
      </div>

      <div className="mt-8 border-t border-border/80 pt-6">
        <SyncRail
          sections={sections}
          activeIndex={activeIndex}
          activeLabel={t("previewActive")}
        />
      </div>
    </div>
  );
}
