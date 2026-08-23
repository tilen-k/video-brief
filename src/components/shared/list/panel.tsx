import { cn } from "@/lib/utils";

type PanelProps = React.ComponentProps<"div"> & {
  padding?: "default" | "none";
};

export function Panel({
  className,
  padding = "default",
  ...props
}: PanelProps) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        padding === "default" && "p-4 shadow-sm sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
