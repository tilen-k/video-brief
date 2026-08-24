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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { SubjectChip } from "@/components/shared/form/subject-chip";
import { useTopLoaderOnPending } from "@/components/shared/layout/use-top-loader-on-pending";
import {
  EDUCATION_LEVELS,
  SUBJECTS,
  SUMMARY_STYLES,
  maxYearOfBirth,
} from "@/lib/validations/onboarding-options";

const initial: OnboardingActionState = {};

export function OnboardingForm() {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState(completeOnboarding, initial);
  useTopLoaderOnPending(pending);
  const maxYear = maxYearOfBirth();

  return (
    <div className="flex w-full max-w-lg flex-col gap-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form action={action} className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="yearOfBirth">{t("yearOfBirth")}</FieldLabel>
            <Input
              id="yearOfBirth"
              name="yearOfBirth"
              type="number"
              inputMode="numeric"
              min={1900}
              max={maxYear}
              placeholder={t("yearOfBirthPlaceholder")}
              disabled={pending}
              className="max-w-40"
            />
            <FieldDescription>{t("yearOfBirthHint")}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="educationLevel">{t("educationLevel")}</FieldLabel>
            <NativeSelect
              id="educationLevel"
              name="educationLevel"
              defaultValue=""
              disabled={pending}
              className="w-full"
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {EDUCATION_LEVELS.map((level) => (
                <NativeSelectOption key={level} value={level}>
                  {t(`educationLevels.${level}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <FieldSet>
            <FieldLegend>{t("subjects")}</FieldLegend>
            <FieldDescription>{t("subjectsHint")}</FieldDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              {SUBJECTS.map((subject) => (
                <SubjectChip
                  key={subject}
                  value={subject}
                  label={t(`subjectLabels.${subject}`)}
                  disabled={pending}
                />
              ))}
            </div>
          </FieldSet>

          <Field>
            <FieldLabel htmlFor="summaryStyle">{t("summaryStyle")}</FieldLabel>
            <NativeSelect
              id="summaryStyle"
              name="summaryStyle"
              defaultValue=""
              disabled={pending}
              className="w-full"
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {SUMMARY_STYLES.map((style) => (
                <NativeSelectOption key={style} value={style}>
                  {t(`summaryStyles.${style}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>{t("summaryStyleHint")}</FieldDescription>
          </Field>

          <FieldDescription>{t("optionalHint")}</FieldDescription>
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
