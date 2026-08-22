"use client";

import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  addVideo,
  type AddVideoActionState,
} from "@/lib/actions/library";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const initial: AddVideoActionState = {};

export function AddVideoForm() {
  const t = useTranslations("Library");
  const [state, action, pending] = useActionState(addVideo, initial);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="url">{t("pasteLabel")}</FieldLabel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Input
            id="url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder={t("pastePlaceholder")}
            disabled={pending}
            required
            className="sm:flex-1"
          />
          <Button type="submit" disabled={pending} className="sm:shrink-0">
            {pending ? <Spinner /> : null}
            {pending ? t("adding") : t("add")}
          </Button>
        </div>
        <FieldDescription>{t("pasteHint")}</FieldDescription>
      </Field>

      {state.error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("addErrorTitle")}</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
