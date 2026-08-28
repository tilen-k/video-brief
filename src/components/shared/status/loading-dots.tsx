import { cn } from "@/lib/utils";

type LoadingDotsProps = {
  className?: string;
  label?: string;
};

export function LoadingDots({ className, label = "Loading" }: LoadingDotsProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <span className="loading-dot size-1.5 rounded-full bg-muted-foreground" />
      <span className="loading-dot size-1.5 rounded-full bg-muted-foreground" />
      <span className="loading-dot size-1.5 rounded-full bg-muted-foreground" />
    </span>
  );
}

type LoadingPanelProps = {
  label: string;
  className?: string;
};

export function LoadingPanel({ label, className }: LoadingPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground",
        className,
      )}
    >
      <LoadingDots label={label} />
      <p>{label}</p>
    </div>
  );
}
