import { getTranslations } from "next-intl/server";

import { SignupForm } from "@/components/auth/signup-form";
import { AuthShell } from "@/components/shared/layout/auth-shell";

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const t = await getTranslations("Auth");
  const { error } = await searchParams;

  const googleError =
    error === "google_linked"
      ? t("googleLinkedError")
      : error === "google"
        ? t("googleError")
        : null;

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-2 text-center lg:text-left">
        <h1 className="font-heading text-3xl tracking-tight">
          {t("signupTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("signupSubtitle")}</p>
        {googleError ? (
          <p className="text-sm text-destructive">{googleError}</p>
        ) : null}
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
        }}
      />
    </AuthShell>
  );
}
