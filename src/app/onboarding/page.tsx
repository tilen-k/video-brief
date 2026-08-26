import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { AppShell } from "@/components/shared/layout/app-shell";
import { isGuestUser } from "@/domain/auth/is-anonymous";
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

  return (
    <AppShell userEmail={user.email} showLogout={false}>
      <OnboardingForm />
    </AppShell>
  );
}
