import { cn } from "@/lib/utils";

import { SyncTimestamp } from "./sync-timestamp";

export type SyncSection = {
  time: string;
  title: string;
};

type SyncRailProps = {
  sections: SyncSection[];
  activeIndex: number;
  activeLabel?: string;
  compact?: boolean;
  className?: string;
};

export function SyncRail({
  sections,
  activeIndex,
  activeLabel,
  compact = false,
  className,
}: SyncRailProps) {
  return (
    <div className={cn("relative flex flex-col", className)}>
      <div
        aria-hidden
        className={cn(
          "absolute bottom-0 left-[7px] top-0 w-px bg-border",
          compact && "left-[5px]",
        )}
      />
      <ul className="flex flex-col">
        {sections.map((section, index) => {
          const isActive = index === activeIndex;

          return (
            <li
              key={`${section.time}-${section.title}`}
              className={cn(
                "relative py-2 pl-5 pr-1 transition-colors",
                compact && "py-1.5 pl-4",
                isActive && "bg-sync/8",
              )}
            >
              <div
                aria-hidden
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 rounded-full",
                  isActive
                    ? "left-0 size-2 bg-sync ring-2 ring-background"
                    : "left-0.5 size-1.5 bg-border",
                  isActive && activeLabel && "sync-marker-pulse",
                )}
              />
              <SyncTimestamp
                variant={compact ? "compact" : "default"}
                className={isActive ? "text-sync" : "text-annotation"}
              >
                {section.time}
              </SyncTimestamp>
              <p
                className={cn(
                  "mt-0.5 leading-snug",
                  compact ? "text-xs" : "text-sm",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {section.title}
              </p>
              {isActive && activeLabel ? (
                <SyncTimestamp
                  variant="compact"
                  className="mt-1 uppercase tracking-wider text-sync"
                >
                  {activeLabel}
                </SyncTimestamp>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
