import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.02_250)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_oklch(0.22_0.03_40)_0%,_transparent_45%)]"
      />
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-heading text-xl tracking-tight text-foreground">
          {t("Brand.name")}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t("Landing.secondary")}</Link>
        </Button>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 pb-24 pt-10">
        <h1 className="max-w-3xl font-heading text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
          {t("Brand.name")}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
          {t("Landing.subtitle")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">{t("Landing.cta")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">{t("Landing.secondary")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
