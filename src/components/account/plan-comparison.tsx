import { UpgradeToProButton } from "@/components/account/billing-actions";
import { Panel } from "@/components/shared/list/panel";
import { analysisConfig } from "@/domain/analysis/config";
import type { PlanId } from "@/db/schema";
import { cn } from "@/lib/utils";

type PlanComparisonLabels = {
  title: string;
  freePlan: string;
  proPlan: string;
  currentBadge: string;
  basicDaily: (values: { count: number }) => string;
  advancedDaily: (values: { count: number }) => string;
  durationNote: string;
  upgradeLabel: string;
  upgradePendingLabel: string;
};

type PlanComparisonProps = {
  currentPlan: PlanId;
  showUpgrade: boolean;
  labels: PlanComparisonLabels;
};

type PlanColumn = {
  plan: PlanId;
  name: string;
  basic: number;
  advanced: number;
};

export function PlanComparison({
  currentPlan,
  showUpgrade,
  labels,
}: PlanComparisonProps) {
  const free = analysisConfig.planLimits.free;
  const pro = analysisConfig.planLimits.pro;

  const columns: PlanColumn[] = [
    {
      plan: "free",
      name: labels.freePlan,
      basic: free.daily.basic,
      advanced: free.daily.advanced,
    },
    {
      plan: "pro",
      name: labels.proPlan,
      basic: pro.daily.basic,
      advanced: pro.daily.advanced,
    },
  ];

  return (
    <Panel className="space-y-4">
      <h2 className="text-sm font-medium text-foreground">{labels.title}</h2>
      <p className="text-sm text-muted-foreground">{labels.durationNote}</p>
      <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
        {columns.map((column) => {
          const isCurrent = column.plan === currentPlan;
          return (
            <div
              key={column.plan}
              className={cn(
                "flex flex-col gap-2 rounded-md border border-border p-4",
                isCurrent && "border-foreground/40",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-heading text-base tracking-tight">
                  {column.name}
                </p>
                {isCurrent ? (
                  <span className="text-xs text-muted-foreground">
                    {labels.currentBadge}
                  </span>
                ) : null}
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>{labels.basicDaily({ count: column.basic })}</li>
                <li>{labels.advancedDaily({ count: column.advanced })}</li>
              </ul>
            </div>
          );
        })}
      </div>
      {showUpgrade ? (
        <div className="w-full sm:flex sm:justify-center">
          <UpgradeToProButton
            className="w-full sm:w-auto sm:min-w-56"
            label={labels.upgradeLabel}
            pendingLabel={labels.upgradePendingLabel}
          />
        </div>
      ) : null}
    </Panel>
  );
}
