import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function WorkspaceNotFound() {
  const t = await getTranslations("Workspace");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-heading text-2xl tracking-tight">
        {t("notFoundTitle")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Link
        href="/library"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("notFoundBack")}
      </Link>
    </main>
  );
}
