import { getTranslations } from "next-intl/server";

import { AppBrand } from "@/components/shared/layout/app-brand";
import { AppHeader } from "@/components/shared/layout/app-header";
import { ThemeToggle } from "@/components/shared/layout/theme-toggle";

type AuthShellProps = {
  children: React.ReactNode;
};

export async function AuthShell({ children }: AuthShellProps) {
  const brand = await getTranslations("Brand");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader
        left={<AppBrand name={brand("name")} />}
        right={<ThemeToggle />}
      />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}
