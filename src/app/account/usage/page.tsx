import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/shared/list/panel";

export default async function AccountUsagePage() {
  const t = await getTranslations("Account");

  return (
    <Panel className="max-w-lg space-y-2">
      <h2 className="text-sm font-medium text-foreground">{t("usageTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("usageBody")}</p>
    </Panel>
  );
}
