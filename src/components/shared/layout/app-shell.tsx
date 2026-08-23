import { getTranslations } from "next-intl/server";

import { AppBrand } from "@/components/shared/layout/app-brand";
import { ThemeToggle } from "@/components/shared/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
  showLogout?: boolean;
  contentClassName?: string;
};

export async function AppShell({
  children,
  userEmail,
  showLogout = true,
  contentClassName,
}: AppShellProps) {
  const brand = await getTranslations("Brand");
  const library = await getTranslations("Library");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <AppBrand name={brand("name")} />
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {library("title")}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {userEmail ? (
              <span className="hidden max-w-[11rem] truncate text-sm text-muted-foreground md:inline">
                {userEmail}
              </span>
            ) : null}
            <ThemeToggle />
            {showLogout ? (
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  {library("logout")}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

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
