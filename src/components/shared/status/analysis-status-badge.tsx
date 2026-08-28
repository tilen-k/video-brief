import {
  analysisUiPhase,
  type AnalysisUiPhase,
} from "@/domain/workspace/analysis-ui";
import type { AnalysisStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

type AnalysisStatusBadgeProps = {
  status: AnalysisStatus;
  label: string;
  className?: string;
};

function badgeVariantForPhase(
  phase: AnalysisUiPhase,
): "muted" | "destructive" | "progress" {
  switch (phase) {
    case "complete":
      return "muted";
    case "failed":
      return "destructive";
    default:
      return "progress";
  }
}

export function AnalysisStatusBadge({
  status,
  label,
  className,
}: AnalysisStatusBadgeProps) {
  const phase = analysisUiPhase(status);

  return (
    <Badge
      variant={badgeVariantForPhase(phase)}
      size="status"
      className={className}
    >
      {label}
    </Badge>
  );
}
