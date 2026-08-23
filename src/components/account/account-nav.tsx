"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AccountNavProps = {
  profileLabel: string;
  usageLabel: string;
};

const items = [
  { href: "/account", key: "profile" as const },
  { href: "/account/usage", key: "usage" as const },
];

export function AccountNav({ profileLabel, usageLabel }: AccountNavProps) {
  const pathname = usePathname();
  const labels = { profile: profileLabel, usage: usageLabel };

  return (
    <nav aria-label="Account" className="flex gap-1 border-b border-border">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "-mb-px border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
