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
import {
  EDUCATION_LEVELS,
  SUBJECTS,
  maxYearOfBirth,
} from "@/lib/validations/onboarding-options";
import { cn } from "@/lib/utils";

const initial: OnboardingActionState = {};

export function OnboardingForm() {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState(completeOnboarding, initial);
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
                <label
                  key={subject}
                  className={cn(
                    "cursor-pointer select-none rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors",
                    "has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background",
                    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    name="subjects"
                    value={subject}
                    disabled={pending}
                    className="sr-only"
                  />
                  {t(`subjectLabels.${subject}`)}
                </label>
              ))}
            </div>
          </FieldSet>

          <FieldDescription>{t("optionalHint")}</FieldDescription>
        </FieldGroup>

        {state.error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Something went wrong</AlertTitle>
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
