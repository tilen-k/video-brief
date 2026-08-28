"use client";

import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  completeOnboarding,
  type OnboardingActionState,
} from "@/lib/actions/onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useTopLoaderOnPending } from "@/components/shared/layout/use-top-loader-on-pending";

const initial: OnboardingActionState = {};

function PrefSlider({
  id,
  name,
  label,
  minLabel,
  maxLabel,
  defaultValue,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  minLabel: string;
  maxLabel: string;
  defaultValue: number;
  disabled: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        name={name}
        type="range"
        min={0}
        max={100}
        step={1}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground disabled:cursor-not-allowed"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </Field>
  );
}

export function OnboardingForm() {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState(completeOnboarding, initial);
  useTopLoaderOnPending(pending);

  return (
    <div className="flex w-full max-w-lg flex-col gap-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form action={action} className="flex flex-col gap-6">
        <FieldGroup>
          <PrefSlider
            id="summaryTone"
            name="summaryTone"
            label={t("toneLabel")}
            minLabel={t("toneLow")}
            maxLabel={t("toneHigh")}
            defaultValue={50}
            disabled={pending}
          />
          <PrefSlider
            id="summaryLength"
            name="summaryLength"
            label={t("lengthLabel")}
            minLabel={t("lengthLow")}
            maxLabel={t("lengthHigh")}
            defaultValue={50}
            disabled={pending}
          />
        </FieldGroup>

        {state.error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("errorTitle")}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field orientation="horizontal" className="flex-wrap sm:flex-nowrap">
          <Button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="sm:flex-1"
          >
            {pending ? <Spinner /> : null}
            {t("continue")}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="skip"
            variant="ghost"
            disabled={pending}
            formNoValidate
          >
            {t("skip")}
          </Button>
        </Field>
      </form>
    </div>
  );
}
