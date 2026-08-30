import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AppBrand } from "@/components/shared/layout/app-brand";
import { AppHeader } from "@/components/shared/layout/app-header";
import { ThemeToggle } from "@/components/shared/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
  userEmailHref?: string;
  sectionLabel?: string;
  showLogout?: boolean;
  contentClassName?: string;
  isGuest?: boolean;
  signUpLabel?: string;
  signInLabel?: string;
};

export async function AppShell({
  children,
  userEmail,
  userEmailHref,
  sectionLabel,
  showLogout = true,
  contentClassName,
  isGuest = false,
  signUpLabel,
  signInLabel,
}: AppShellProps) {
  const brand = await getTranslations("Brand");
  const library = await getTranslations("Library");
  const auth = await getTranslations("Auth");

  const left = (
    <>
      <AppBrand name={brand("name")} />
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
      <span className="hidden truncate text-sm text-muted-foreground sm:inline">
        {sectionLabel ?? library("title")}
      </span>
    </>
  );

  const right = isGuest ? (
    <>
      <Button asChild size="sm">
        <Link href="/signup">{signUpLabel ?? auth("signup")}</Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">{signInLabel ?? auth("login")}</Link>
      </Button>
      <ThemeToggle />
    </>
  ) : (
    <>
      {userEmail ? (
        userEmailHref ? (
          <Link
            href={userEmailHref}
            title={userEmail}
            className="min-w-0 cursor-pointer truncate text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {userEmail}
          </Link>
        ) : (
          <span
            title={userEmail}
            className="hidden min-w-0 truncate text-sm text-muted-foreground md:inline"
          >
            {userEmail}
          </span>
        )
      ) : null}
      <ThemeToggle className="shrink-0" />
      {showLogout ? (
        <form action="/auth/signout" method="post" className="shrink-0">
          <Button type="submit" variant="outline" size="sm">
            {library("logout")}
          </Button>
        </form>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader left={left} right={right} />

      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
