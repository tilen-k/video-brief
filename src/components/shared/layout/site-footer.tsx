import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { GithubIcon } from "@/components/shared/icons/github-icon";
import { siteConfig } from "@/lib/site-config";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="mt-auto border-t border-border/80 px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center">
        <Link
          href={siteConfig.githubUrl}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          <GithubIcon />
          <span>{t("github")}</span>
        </Link>
      </div>
    </footer>
  );
}
