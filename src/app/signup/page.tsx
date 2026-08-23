import { getTranslations } from "next-intl/server";

import { SignupForm } from "@/components/auth/signup-form";
import { AuthShell } from "@/components/shared/layout/auth-shell";

export default async function SignupPage() {
  const t = await getTranslations("Auth");

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-2 text-center lg:text-left">
        <h1 className="font-heading text-3xl tracking-tight">
          {t("signupTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("signupSubtitle")}</p>
      </div>
      <SignupForm
        copy={{
          email: t("email"),
          password: t("password"),
          signup: t("signup"),
          google: t("google"),
          or: t("or"),
          hasAccount: t("hasAccount"),
          login: t("login"),
          softConfirm: t("softConfirm"),
        }}
      />
    </AuthShell>
  );
}
