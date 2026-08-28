"use client";

import { useEffect, useRef } from "react";

import type { GeneratedSection } from "@/db/schema";
import { EmptyState } from "@/components/shared/list/empty-state";
import { cn } from "@/lib/utils";

type WorkspaceSectionsProps = {
  sections: GeneratedSection[];
  emptyLabel: string;
  listLabel: string;
  currentTime: number;
  onSeek: (startTime: number) => void;
};

export function formatSectionTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function isActiveSection(
  section: GeneratedSection,
  currentTime: number,
): boolean {
  return currentTime >= section.startTime && currentTime < section.endTime;
}

export function WorkspaceSections({
  sections,
  emptyLabel,
  listLabel,
  currentTime,
  onSeek,
}: WorkspaceSectionsProps) {
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const activeIndex = sections.findIndex((section) =>
    isActiveSection(section, currentTime),
  );

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    const node = itemRefs.current[activeIndex];
    if (!node) {
      return;
    }
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeIndex]);

  if (sections.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>;
  }

  return (
    <ol className="flex flex-col" aria-label={listLabel}>
      {sections.map((section, index) => {
        const active = index === activeIndex;
        return (
          <li
            key={`${section.startTime}-${section.title}`}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            className={cn(
              "border-b border-border last:border-b-0",
              active && "bg-muted/60",
            )}
          >
            <button
              type="button"
              onClick={() => onSeek(section.startTime)}
              className="w-full cursor-pointer px-1 py-3 text-left"
            >
              <p className="text-sm leading-snug text-foreground">
                <span className="tabular-nums text-muted-foreground">
                  {formatSectionTime(section.startTime)}
                </span>
                <span aria-hidden className="text-muted-foreground">
                  {" · "}
                </span>
                {section.title}
              </p>
            </button>
            <div className="select-text px-1 pb-3 text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
