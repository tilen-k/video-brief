"use client";

import { SUMMARY_LANGUAGES } from "@/domain/i18n/summary-languages";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type SummaryLanguageSelectProps = {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  disabled?: boolean;
  className?: string;
};

export function SummaryLanguageSelect({
  id,
  name,
  label,
  defaultValue,
  disabled = false,
  className,
}: SummaryLanguageSelectProps) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="w-full"
      >
        {SUMMARY_LANGUAGES.map((entry) => (
          <NativeSelectOption key={entry.code} value={entry.code}>
            {entry.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
