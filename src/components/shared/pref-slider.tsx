"use client";

import type { ChangeEvent } from "react";

import { cn } from "@/lib/utils";

type PrefSliderProps = {
  id: string;
  name: string;
  label: string;
  minLabel: string;
  maxLabel: string;
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  disabled: boolean;
  className?: string;
};

export function PrefSlider({
  id,
  name,
  label,
  minLabel,
  maxLabel,
  defaultValue,
  value,
  onValueChange,
  disabled,
  className,
}: PrefSliderProps) {
  const controlled = value != null && onValueChange != null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
      {/* Taller hit area around a thicker track — easier to grab than h-2 alone. */}
      <div className="flex h-8 items-center">
        <input
          id={id}
          name={name}
          type="range"
          min={0}
          max={100}
          step={1}
          {...(controlled
            ? {
                value,
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                  onValueChange(Number(event.target.value));
                },
              }
            : { defaultValue })}
          disabled={disabled}
          className={cn(
            "h-3 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground",
            "disabled:cursor-not-allowed",
            "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground",
            "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground",
          )}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
