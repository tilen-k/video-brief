import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type ListRowLinkProps = {
  href?: string;
  disabled?: boolean;
  showChevron?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
};

export function ListRowLink({
  href,
  disabled = false,
  showChevron = true,
  className,
  children,
  "aria-label": ariaLabel,
}: ListRowLinkProps) {
  const rowClassName = cn(
    "flex gap-4 px-4 py-3.5",
    !disabled &&
      "group cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring/50",
    disabled && "cursor-default opacity-90",
    className,
  );

  const content = (
    <>
      {children}
      {!disabled && showChevron ? (
        <ChevronRight
          className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (disabled || !href) {
    return (
      <div className={rowClassName} aria-disabled={disabled || undefined}>
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={rowClassName} aria-label={ariaLabel}>
      {content}
    </Link>
  );
}
