import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/account/password-form";
import { Panel } from "@/components/shared/list/panel";
import { userHasPassword } from "@/domain/account";
import { isGuestUser } from "@/domain/auth/is-anonymous";
import { createClient } from "@/lib/supabase/server";

export default async function AccountSecurityPage() {
  const t = await getTranslations("Account");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/security");
  }

  if (isGuestUser(user)) {
    redirect("/");
  }

  return (
    <Panel className="max-w-lg">
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">
          {t("passwordTitle")}
        </h2>
        <PasswordForm hasPassword={userHasPassword(user)} />
      </div>
    </Panel>
  );
}
