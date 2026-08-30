import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { SummaryPreferencesForm } from "@/components/account/summary-preferences-form";
import { Panel } from "@/components/shared/list/panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUserProfile } from "@/domain/analysis/get-user-profile";
import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
} from "@/domain/analysis/prefs";
import { DEFAULT_SUMMARY_LANGUAGE } from "@/domain/i18n/summary-languages";
import { isGuestUser } from "@/domain/auth/is-anonymous";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const t = await getTranslations("Account");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  if (isGuestUser(user)) {
    redirect("/");
  }

  const profile = await getUserProfile(user.id);

  return (
    <Panel className="max-w-lg">
      <div className="flex flex-col gap-8">
        <div className="space-y-2">
          <Label htmlFor="account-email">{t("email")}</Label>
          <Input
            id="account-email"
            value={user.email ?? ""}
            readOnly
            autoComplete="username"
            className="cursor-text caret-transparent"
          />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">
            {t("preferencesTitle")}
          </h2>
          <SummaryPreferencesForm
            defaultSummaryLanguage={
              profile?.defaultSummaryLanguage ?? DEFAULT_SUMMARY_LANGUAGE
            }
            summaryTone={profile?.summaryTone ?? DEFAULT_TONE_SCORE}
            summaryLength={profile?.summaryLength ?? DEFAULT_LENGTH_SCORE}
          />
        </div>
      </div>
    </Panel>
  );
}
