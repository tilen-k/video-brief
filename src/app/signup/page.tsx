import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage() {
  const t = await getTranslations("Auth");
  const brand = await getTranslations("Brand");

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="font-heading text-2xl tracking-tight">
          {brand("name")}
        </Link>
        <h1 className="text-lg text-muted-foreground">{t("signupTitle")}</h1>
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
    </main>
  );
}
