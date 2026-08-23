import { cn } from "@/lib/utils";

type SyncTimestampProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "compact" | "caption";
};

export function SyncTimestamp({
  children,
  className,
  variant = "default",
}: SyncTimestampProps) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        variant === "default" && "text-[0.65rem] tracking-wide",
        variant === "compact" && "text-[0.6rem] tracking-wide",
        variant === "caption" &&
          "text-[0.65rem] uppercase tracking-[0.16em]",
        className,
      )}
    >
      {children}
    </span>
  );
}
