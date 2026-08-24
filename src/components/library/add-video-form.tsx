"use client";

import { AlertCircleIcon, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  addVideo,
  type AddVideoActionState,
} from "@/lib/actions/library";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const initial: AddVideoActionState = {};

type AddVideoFormProps = {
  defaultLength: number;
};

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
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
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
    </div>
  );
}

export function AddVideoForm({ defaultLength }: AddVideoFormProps) {
  const t = useTranslations("Library");
  const [state, action, pending] = useActionState(addVideo, initial);

  return (
    <form
      key={state.addedUserVideoId ?? "idle"}
      action={action}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Link2
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder={t("pastePlaceholder")}
            disabled={pending}
            required
            className="h-11 pl-9"
            aria-label={t("pasteLabel")}
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          size="lg"
          className="h-11 shrink-0 px-6 sm:min-w-[7rem]"
        >
          {pending ? <Spinner /> : null}
          {pending ? t("adding") : t("add")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PrefSlider
          id="familiarity"
          name="familiarity"
          label={t("familiarityLabel")}
          minLabel={t("familiarityLow")}
          maxLabel={t("familiarityHigh")}
          defaultValue={50}
          disabled={pending}
        />
        <PrefSlider
          id="summaryLength"
          name="summaryLength"
          label={t("lengthLabel")}
          minLabel={t("lengthLow")}
          maxLabel={t("lengthHigh")}
          defaultValue={defaultLength}
          disabled={pending}
        />
      </div>

      <p className="text-xs text-muted-foreground">{t("pasteHint")}</p>

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
