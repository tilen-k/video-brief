import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SyncPreview } from "@/components/landing/sync-preview";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="relative flex min-h-full flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.28_0.04_85_/_0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,oklch(0.25_0.03_260_/_0.15),transparent)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-heading text-xl tracking-tight text-foreground">
          {t("Brand.name")}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t("Landing.secondary")}</Link>
        </Button>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-16 lg:pb-28 lg:pt-4">
        <div className="flex flex-col gap-7">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-primary">
            {t("Landing.eyebrow")}
          </p>
          <h1 className="max-w-xl font-heading text-[2.75rem] leading-[1.06] tracking-tight text-foreground sm:text-6xl lg:text-[3.75rem]">
            {t("Landing.headline")}
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            {t("Landing.subtitle")}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild size="lg">
              <Link href="/signup">{t("Landing.cta")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">{t("Landing.secondary")}</Link>
            </Button>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <SyncPreview />
        </div>
      </section>
    </main>
  );
}
