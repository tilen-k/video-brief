import { cn } from "@/lib/utils";

type AppHeaderProps = {
  left: React.ReactNode;
  right?: React.ReactNode;
  /** Constrain inner row (app pages use max-w-6xl; auth can be full width). */
  contentClassName?: string;
  className?: string;
};

/** Shared sticky top bar for app and auth surfaces. */
export function AppHeader({
  left,
  right,
  contentClassName,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6",
          contentClassName ?? "max-w-6xl",
        )}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-3">{left}</div>
        {right ? (
          <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}
