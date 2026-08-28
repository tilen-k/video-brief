import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { AppShell } from "@/components/shared/layout/app-shell";
import { getUserProfile } from "@/domain/analysis/get-user-profile";
import { isGuestUser } from "@/domain/auth/is-anonymous";
import { DEFAULT_SUMMARY_LANGUAGE } from "@/domain/i18n/summary-languages";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  if (isGuestUser(user)) {
    redirect("/");
  }

  if (await getOnboardingCompleted(user.id)) {
    redirect("/");
  }

  const acceptLanguage = (await headers()).get("accept-language");
  const profile = await getUserProfile(user.id, { acceptLanguage });

  return (
    <AppShell userEmail={user.email} showLogout={false}>
      <OnboardingForm
        defaultSummaryLanguage={
          profile?.defaultSummaryLanguage ?? DEFAULT_SUMMARY_LANGUAGE
        }
      />
    </AppShell>
  );
}
