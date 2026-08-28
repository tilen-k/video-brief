"use client";

import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  updateDefaultSummaryLanguage,
  type SummaryPreferencesActionState,
} from "@/lib/actions/account-preferences";
import { SummaryLanguageSelect } from "@/components/shared/summary-language-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const initial: SummaryPreferencesActionState = {};

type SummaryPreferencesFormProps = {
  defaultSummaryLanguage: string;
};

export function SummaryPreferencesForm({
  defaultSummaryLanguage,
}: SummaryPreferencesFormProps) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState(
    updateDefaultSummaryLanguage,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <SummaryLanguageSelect
        id="defaultSummaryLanguage"
        name="defaultSummaryLanguage"
        label={t("summaryLanguageLabel")}
        defaultValue={defaultSummaryLanguage}
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
