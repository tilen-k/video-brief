import Link from "next/link";

import { cn } from "@/lib/utils";

type AppBrandProps = {
  name: string;
  href?: string;
  className?: string;
};

export function AppBrand({ name, href = "/", className }: AppBrandProps) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 text-base font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      {name}
    </Link>
  );
}
