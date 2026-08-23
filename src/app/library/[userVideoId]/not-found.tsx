import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/shared/list/panel";

export default async function WorkspaceNotFound() {
  const t = await getTranslations("Workspace");

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <Panel className="w-full max-w-md space-y-4">
        <h1 className="font-heading text-2xl tracking-tight">
          {t("notFoundTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("notFoundBody")}</p>
        <Link
          href="/library"
          className="inline-flex items-center gap-0.5 text-sm text-foreground transition-colors hover:text-muted-foreground"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          {t("notFoundBack")}
        </Link>
      </Panel>
    </main>
  );
}
