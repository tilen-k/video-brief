import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

type AuthShellProps = {
  children: React.ReactNode;
};

export async function AuthShell({ children }: AuthShellProps) {
  const brand = await getTranslations("Brand");

  return (
    <div className="flex min-h-full flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="hidden border-r border-border lg:block">
        <AuthBrandPanel />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:py-16">
        <Link
          href="/"
          className="mb-8 font-heading text-2xl tracking-tight hover:text-foreground/80 lg:hidden"
        >
          {brand("name")}
        </Link>

        <div className="flex w-full max-w-sm flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}
