import {
  analysisUiPhase,
  type AnalysisUiPhase,
} from "@/domain/workspace/analysis-ui";
import type { AnalysisStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AnalysisStatusBadgeProps = {
  status: AnalysisStatus;
  label: string;
  className?: string;
};

function badgeVariantForPhase(
  phase: AnalysisUiPhase,
): "sync" | "destructive" | "awaiting" | "progress" {
  switch (phase) {
    case "complete":
      return "sync";
    case "failed":
      return "destructive";
    case "awaiting":
      return "awaiting";
    default:
      return "progress";
  }
}

function shouldPulse(phase: AnalysisUiPhase): boolean {
  return (
    phase === "fetching" ||
    phase === "understanding" ||
    phase === "generating"
  );
}

export function AnalysisStatusBadge({
  status,
  label,
  className,
}: AnalysisStatusBadgeProps) {
  const phase = analysisUiPhase(status);
  const pulse = shouldPulse(phase);

  return (
    <Badge
      variant={badgeVariantForPhase(phase)}
      size="status"
      className={cn(pulse && "sync-marker-pulse", className)}
    >
      {label}
    </Badge>
  );
}
