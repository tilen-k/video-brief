import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SyncPreview } from "@/components/landing/sync-preview";
import { ThemeToggle } from "@/components/shared/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="relative flex min-h-full flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,oklch(0.72_0.12_85_/_0.08),transparent),radial-gradient(ellipse_70%_45%_at_100%_100%,oklch(0.58_0.06_250_/_0.06),transparent)] dark:bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,oklch(0.72_0.12_85_/_0.1),transparent),radial-gradient(ellipse_70%_45%_at_100%_100%,oklch(0.58_0.06_250_/_0.08),transparent)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-heading text-xl tracking-tight text-foreground">
          {t("Brand.name")}
        </span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t("Landing.secondary")}</Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 pb-20 pt-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-14 lg:pb-28 lg:pt-0">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <h1 className="max-w-xl font-heading text-[2.5rem] leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
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

        <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <SyncPreview />
        </div>
      </section>
    </main>
  );
}
