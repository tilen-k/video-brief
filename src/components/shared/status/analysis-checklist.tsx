import type { ChecklistStep } from "@/domain/workspace/analysis-ui";
import { cn } from "@/lib/utils";

type AnalysisChecklistProps = {
  steps: ChecklistStep[];
  getLabel: (stepId: ChecklistStep["id"]) => string;
  ariaLabel: string;
  className?: string;
};

export function AnalysisChecklist({
  steps,
  getLabel,
  ariaLabel,
  className,
}: AnalysisChecklistProps) {
  return (
    <ol
      className={cn("relative flex flex-col py-2", className)}
      aria-label={ariaLabel}
    >
      <div
        aria-hidden
        className="absolute bottom-3 left-[7px] top-3 w-px bg-border"
      />
      {steps.map((step) => {
        const isCurrent = step.state === "current";
        const isDone = step.state === "done";

        return (
          <li
            key={step.id}
            className={cn(
              "relative py-2.5 pl-5 pr-1 transition-colors",
              isCurrent && "bg-sync/8",
            )}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div
              aria-hidden
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full",
                isCurrent &&
                  "left-0 size-2 bg-sync ring-2 ring-background sync-marker-pulse",
                isDone && "left-0.5 size-1.5 bg-sync/80",
                step.state === "upcoming" && "left-0.5 size-1.5 bg-border",
              )}
            />
            <p
              className={cn(
                "text-sm leading-snug",
                isCurrent && "text-foreground",
                isDone && "text-foreground/85",
                step.state === "upcoming" && "text-muted-foreground",
              )}
            >
              {getLabel(step.id)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
