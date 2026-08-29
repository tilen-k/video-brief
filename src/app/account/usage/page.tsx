import { getTranslations } from "next-intl/server";

import {
  ManageBillingButton,
  UpgradeToProButton,
} from "@/components/account/billing-actions";
import { Panel } from "@/components/shared/list/panel";
import {
  getBillingProfileState,
  isPastDueStatus,
} from "@/domain/billing";
import { getUsageSnapshot, UsageError } from "@/domain/usage";
import { isDemoMode } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";

function formatResetDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function formatDurationLimit(
  maxDurationSeconds: number | null,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  if (maxDurationSeconds == null) {
    return t("usageDurationUnlimited");
  }
  if (maxDurationSeconds >= 3600 && maxDurationSeconds % 3600 === 0) {
    return t("usageDurationHours", {
      hours: maxDurationSeconds / 3600,
    });
  }
  return t("usageDurationMinutes", {
    minutes: Math.round(maxDurationSeconds / 60),
  });
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

  const billing = await getBillingProfileState(user.id);
  const planLabel =
    snapshot.plan === "pro" ? t("planPro") : t("planFree");
  const durationLabel = formatDurationLimit(snapshot.maxDurationSeconds, t);

  const showPastDue = isPastDueStatus(billing.stripeSubscriptionStatus);
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
      {showPastDue ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("billingPastDue")}
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
      </div>
      <p className="text-sm text-muted-foreground">{durationLabel}</p>
      {snapshot.plan === "free" ? (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">{t("upgradeHint")}</p>
          <UpgradeToProButton
            label={t("upgradeToPro")}
            pendingLabel={t("upgradePending")}
          />
        </div>
      ) : (
        <div className="space-y-2 border-t border-border pt-4">
          <ManageBillingButton
            label={t("manageBilling")}
            pendingLabel={t("manageBillingPending")}
          />
        </div>
      )}
      </Panel>
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
