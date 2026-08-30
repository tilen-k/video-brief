import { getTranslations } from "next-intl/server";

import {
  CompletePaymentButton,
  ManageBillingButton,
} from "@/components/account/billing-actions";
import { PlanComparison } from "@/components/account/plan-comparison";
import { Panel } from "@/components/shared/list/panel";
import { getBillingStateForUsage } from "@/domain/billing";
import { analysisConfig } from "@/domain/analysis/config";
import { getUsageSnapshot, UsageError } from "@/domain/usage";
import { isDemoMode } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";

function formatResetDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

type AccountUsagePageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function AccountUsagePage({
  searchParams,
}: AccountUsagePageProps) {
  const t = await getTranslations("Account");
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const billing = await getBillingStateForUsage(user.id);

  let snapshot;
  try {
    snapshot = await getUsageSnapshot(user.id);
  } catch (error) {
    const message =
      error instanceof UsageError
        ? error.message
        : t("usageUnavailable");
    return (
      <Panel className="max-w-lg space-y-2">
        <h2 className="text-sm font-medium text-foreground">{t("usageTitle")}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </Panel>
    );
  }

  const planLabel =
    billing.plan === "pro" ? t("planPro") : t("planFree");
  const basicMinutes = Math.round(
    analysisConfig.modelTiers.basic.maxDurationSeconds / 60,
  );
  const advancedHours =
    analysisConfig.modelTiers.advanced.maxDurationSeconds / 3600;

  const showDemoDisclaimer = isDemoMode();
  const checkoutBanner =
    params.checkout === "success"
      ? t("checkoutSuccess")
      : params.checkout === "canceled"
        ? t("checkoutCanceled")
        : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <Panel className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-foreground">{t("usageTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("usagePlan", { plan: planLabel })}
          </p>
        </div>
        {checkoutBanner ? (
          <p className="text-sm text-muted-foreground" role="status">
            {checkoutBanner}
          </p>
        ) : null}
        {billing.showPastDueBanner ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("billingPastDue")}
          </p>
        ) : null}
        {billing.needsPaymentCompletion ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("billingIncomplete")}
          </p>
        ) : null}
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            {t("usageTierLine", {
              tier: t("usageTierAdvanced"),
              used: snapshot.tiers.advanced.used,
              limit: snapshot.tiers.advanced.limit,
            })}
          </p>
          <p className="text-sm text-foreground">
            {t("usageTierLine", {
              tier: t("usageTierBasic"),
              used: snapshot.tiers.basic.used,
              limit: snapshot.tiers.basic.limit,
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("usageResetsOn", {
              date: formatResetDate(snapshot.periodEndsAt, "en"),
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("usageDurationBasic", { minutes: basicMinutes })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("usageDurationAdvanced", { hours: advancedHours })}
          </p>
        </div>
        {billing.showCompletePayment ? (
          <div className="space-y-2 border-t border-border pt-4">
            <CompletePaymentButton
              label={t("completePayment")}
              pendingLabel={t("completePaymentPending")}
            />
          </div>
        ) : null}
        {billing.showManageBilling ? (
          <div className="space-y-2 border-t border-border pt-4">
            <ManageBillingButton
              label={t("manageBilling")}
              pendingLabel={t("manageBillingPending")}
            />
          </div>
        ) : null}
      </Panel>
      <PlanComparison
        currentPlan={billing.plan}
        showUpgrade={billing.showUpgrade}
        labels={{
          title: t("planCompareTitle"),
          freePlan: t("planFree"),
          proPlan: t("planPro"),
          currentBadge: t("planCompareCurrent"),
          basicDaily: (values) => t("planCompareBasicDaily", values),
          advancedDaily: (values) => t("planCompareAdvancedDaily", values),
          durationNote: t("planCompareDurationNote"),
          upgradeLabel: t("upgradeToPro"),
          upgradePendingLabel: t("upgradePending"),
        }}
      />
      {showDemoDisclaimer ? (
        <Panel>
          <p className="text-sm text-muted-foreground" role="status">
            {t("demoModeDisclaimer")}
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
