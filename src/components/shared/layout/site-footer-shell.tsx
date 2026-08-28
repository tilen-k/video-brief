"use client";

import { usePathname } from "next/navigation";

type SiteFooterShellProps = {
  children: React.ReactNode;
};

export function SiteFooterShell({ children }: SiteFooterShellProps) {
  const pathname = usePathname();

  if (pathname.startsWith("/v/")) {
    return null;
  }

  return children;
}
