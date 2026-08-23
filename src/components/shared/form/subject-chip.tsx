"use client";

import { cn } from "@/lib/utils";

type SubjectChipProps = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function SubjectChip({ value, label, disabled }: SubjectChipProps) {
  return (
    <label
      className={cn(
        "cursor-pointer select-none rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-[border-color,background-color,color]",
        "has-[:checked]:border-sync has-[:checked]:bg-sync/10 has-[:checked]:text-foreground",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
      )}
    >
      <input
        type="checkbox"
        name="subjects"
        value={value}
        disabled={disabled}
        className="sr-only"
      />
      {label}
    </label>
  );
}
