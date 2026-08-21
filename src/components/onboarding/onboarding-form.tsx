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
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const initial: OnboardingActionState = {};

export function OnboardingForm() {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState(completeOnboarding, initial);

  return (
    <div className="flex w-full max-w-lg flex-col gap-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form action={action} className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="role">{t("role")}</FieldLabel>
            <Input
              id="role"
              name="role"
              placeholder={t("rolePlaceholder")}
              maxLength={200}
              disabled={pending}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="background">{t("background")}</FieldLabel>
            <Textarea
              id="background"
              name="background"
              placeholder={t("backgroundPlaceholder")}
              maxLength={2000}
              rows={4}
              disabled={pending}
              className="resize-none"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="interests">{t("interests")}</FieldLabel>
            <Input
              id="interests"
              name="interests"
              placeholder={t("interestsPlaceholder")}
              maxLength={1000}
              disabled={pending}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
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
                <NativeSelectOption value="concise">
                  {t("styleConcise")}
                </NativeSelectOption>
                <NativeSelectOption value="structured">
                  {t("styleStructured")}
                </NativeSelectOption>
                <NativeSelectOption value="narrative">
                  {t("styleNarrative")}
                </NativeSelectOption>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="detailLevel">{t("detailLevel")}</FieldLabel>
              <NativeSelect
                id="detailLevel"
                name="detailLevel"
                defaultValue=""
                disabled={pending}
                className="w-full"
              >
                <NativeSelectOption value="">—</NativeSelectOption>
                <NativeSelectOption value="brief">
                  {t("detailBrief")}
                </NativeSelectOption>
                <NativeSelectOption value="balanced">
                  {t("detailBalanced")}
                </NativeSelectOption>
                <NativeSelectOption value="detailed">
                  {t("detailDetailed")}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>

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
          <Button type="submit" name="intent" value="save" disabled={pending} className="sm:flex-1">
            {pending ? <Spinner /> : null}
            {t("continue")}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="skip"
            variant="ghost"
            disabled={pending}
          >
            {t("skip")}
          </Button>
        </Field>
      </form>
    </div>
  );
}
