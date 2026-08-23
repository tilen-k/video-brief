import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AccountNav } from "@/components/account/account-nav";
import { AppShell } from "@/components/shared/layout/app-shell";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Account");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  if (!(await getOnboardingCompleted(user.id))) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      userEmail={user.email}
      userEmailHref="/account"
      sectionLabel={t("title")}
    >
      <div className="flex flex-col gap-8">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl tracking-tight">{t("title")}</h1>
        </div>
        <AccountNav
          profileLabel={t("profileTab")}
          usageLabel={t("usageTab")}
        />
        {children}
      </div>
    </AppShell>
  );
}
