import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
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

  if (await getOnboardingCompleted(user.id)) {
    redirect("/library");
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
      <OnboardingForm />
    </main>
  );
}
