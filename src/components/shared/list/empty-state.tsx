import { cn } from "@/lib/utils";

type EmptyStateProps = {
  children: React.ReactNode;
  className?: string;
};

export function EmptyState({ children, className }: EmptyStateProps) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
