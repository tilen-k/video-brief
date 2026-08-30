"use client";

import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  updateSummaryPreferences,
  type SummaryPreferencesActionState,
} from "@/lib/actions/account-preferences";
import { PrefSlider } from "@/components/shared/pref-slider";
import { SummaryLanguageSelect } from "@/components/shared/summary-language-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const initial: SummaryPreferencesActionState = {};

type SummaryPreferencesFormProps = {
  defaultSummaryLanguage: string;
  summaryTone: number;
  summaryLength: number;
};

export function SummaryPreferencesForm({
  defaultSummaryLanguage,
  summaryTone,
  summaryLength,
}: SummaryPreferencesFormProps) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState(
    updateSummaryPreferences,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <SummaryLanguageSelect
        id="defaultSummaryLanguage"
        name="defaultSummaryLanguage"
        label={t("summaryLanguageLabel")}
        defaultValue={defaultSummaryLanguage}
        disabled={pending}
      />
      <PrefSlider
        id="summaryTone"
        name="summaryTone"
        label={t("toneLabel")}
        minLabel={t("toneLow")}
        maxLabel={t("toneHigh")}
        defaultValue={summaryTone}
        disabled={pending}
      />
      <PrefSlider
        id="summaryLength"
        name="summaryLength"
        label={t("lengthLabel")}
        minLabel={t("lengthLow")}
        maxLabel={t("lengthHigh")}
        defaultValue={summaryLength}
        disabled={pending}
      />

      {state.error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("preferencesErrorTitle")}</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.success ? (
        <Alert>
          <CheckIcon />
          <AlertDescription>{t("preferencesSaved")}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? <Spinner /> : null}
        {pending ? t("saving") : t("savePreferences")}
      </Button>
    </form>
  );
}
