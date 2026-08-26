import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/shared/layout/auth-shell";

export default async function LoginPage() {
  const t = await getTranslations("Auth");

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-2 text-center lg:text-left">
        <h1 className="font-heading text-3xl tracking-tight">{t("loginTitle")}</h1>
      </div>
      <LoginForm
        copy={{
          email: t("email"),
          password: t("password"),
          login: t("login"),
          google: t("google"),
          or: t("or"),
          noAccount: t("noAccount"),
          signup: t("signup"),
        }}
      />
    </AuthShell>
  );
}
