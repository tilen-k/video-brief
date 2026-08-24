import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/shared/list/panel";
import { getUsageSnapshot, UsageError } from "@/domain/usage";
import { createClient } from "@/lib/supabase/server";

function formatResetDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default async function AccountUsagePage() {
  const t = await getTranslations("Account");
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

  const planLabel =
    snapshot.plan === "pro" ? t("planPro") : t("planFree");
  const durationLabel =
    snapshot.maxDurationSeconds == null
      ? t("usageDurationUnlimited")
      : t("usageDurationMinutes", {
          minutes: Math.round(snapshot.maxDurationSeconds / 60),
        });

  return (
    <Panel className="max-w-lg space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-foreground">{t("usageTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("usagePlan", { plan: planLabel })}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-foreground">
          {t("usageUsedOfLimit", {
            used: snapshot.used,
            limit: snapshot.limit,
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("usageResetsOn", {
            date: formatResetDate(snapshot.periodEndsAt, "en"),
          })}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{durationLabel}</p>
    </Panel>
  );
}
