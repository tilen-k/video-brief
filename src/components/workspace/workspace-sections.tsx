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
  if (sections.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>;
  }

  return (
    <ol className="flex flex-col" aria-label={listLabel}>
      {sections.map((section) => {
        const active = isActiveSection(section, currentTime);
        return (
          <li key={`${section.startTime}-${section.title}`}>
            <button
              type="button"
              onClick={() => onSeek(section.startTime)}
              className={cn(
                "w-full cursor-pointer border-b border-border py-3 text-left last:border-b-0",
                active && "bg-muted/60",
              )}
            >
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatSectionTime(section.startTime)}
                <span aria-hidden> – </span>
                {formatSectionTime(section.endTime)}
              </p>
              <p className="text-sm leading-snug text-foreground">
                {section.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
