"use client";

import Image from "next/image";
import { AlertCircleIcon, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import {
  generateVideo,
  previewYoutube,
  type GenerateVideoActionState,
  type PreviewYoutubeActionState,
} from "@/lib/actions/library";
import { useTopLoaderOnPending } from "@/components/shared/layout/use-top-loader-on-pending";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const previewInitial: PreviewYoutubeActionState = {};
const generateInitial: GenerateVideoActionState = {};

type AddVideoFormProps = {
  defaultLength: number;
  defaultTone: number;
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

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds < 0) {
    return null;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AddVideoForm({ defaultLength, defaultTone }: AddVideoFormProps) {
  const t = useTranslations("Library");
  const [previewState, previewAction, previewPending] = useActionState(
    previewYoutube,
    previewInitial,
  );
  const [generateState, generateAction, generatePending] = useActionState(
    generateVideo,
    generateInitial,
  );
  const [urlDraft, setUrlDraft] = useState("");
  const [dismissedPreview, setDismissedPreview] = useState(false);
  const [hideGenerateError, setHideGenerateError] = useState(false);
  useTopLoaderOnPending(previewPending || generatePending);

  const preview =
    dismissedPreview || !previewState.preview ? null : previewState.preview;
  const pending = previewPending || generatePending;
  const generateError =
    hideGenerateError || !generateState.error ? null : generateState.error;
  const generateErrorCode = generateError ? generateState.errorCode : undefined;

  if (preview) {
    const durationLabel = formatDuration(preview.durationSeconds);

    return (
      <form
        action={generateAction}
        className="flex w-full flex-col gap-5"
        onSubmit={() => setHideGenerateError(false)}
      >
        <input type="hidden" name="youtubeId" value={preview.youtubeId} />

        <div className="flex gap-4">
          {preview.thumbnailUrl ? (
            <div className="relative h-20 w-36 shrink-0 overflow-hidden bg-muted">
              <Image
                src={preview.thumbnailUrl}
                alt=""
                fill
                className="object-cover"
                sizes="144px"
              />
            </div>
          ) : (
            <div className="h-20 w-36 shrink-0 bg-muted" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-heading text-base tracking-tight">
              {preview.title}
            </p>
            {preview.channelTitle ? (
              <p className="truncate text-sm text-muted-foreground">
                {preview.channelTitle}
              </p>
            ) : null}
            {durationLabel ? (
              <p className="text-xs text-muted-foreground">{durationLabel}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PrefSlider
            id="summaryLength"
            name="summaryLength"
            label={t("lengthLabel")}
            minLabel={t("lengthLow")}
            maxLabel={t("lengthHigh")}
            defaultValue={defaultLength}
            disabled={pending || Boolean(preview.tooLong)}
          />
          <PrefSlider
            id="summaryTone"
            name="summaryTone"
            label={t("toneLabel")}
            minLabel={t("toneLow")}
            maxLabel={t("toneHigh")}
            defaultValue={defaultTone}
            disabled={pending || Boolean(preview.tooLong)}
          />
          {preview.showFamiliarity ? (
            <PrefSlider
              id="familiarity"
              name="familiarity"
              label={t("familiarityLabel")}
              minLabel={t("familiarityLow")}
              maxLabel={t("familiarityHigh")}
              defaultValue={50}
              disabled={pending || Boolean(preview.tooLong)}
            />
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">{t("generateHint")}</p>

        {preview.tooLong ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("tooLongTitle")}</AlertTitle>
            <AlertDescription>{t("tooLongBody")}</AlertDescription>
          </Alert>
        ) : null}

        {generateError ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("generateErrorTitle")}</AlertTitle>
            <AlertDescription>
              {generateErrorCode === "quota_exceeded"
                ? t("quotaExceeded")
                : generateErrorCode === "usage_unavailable"
                  ? t("usageUnavailable")
                  : generateErrorCode === "too_long"
                    ? t("tooLongBody")
                    : generateError}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={pending || Boolean(preview.tooLong)}
            size="lg"
            className="h-11 px-6"
          >
            {generatePending ? <Spinner /> : null}
            {generatePending ? t("generating") : t("generate")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDismissedPreview(true);
              setHideGenerateError(true);
              setUrlDraft("");
            }}
          >
            {t("clearPreview")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      action={previewAction}
      className="flex w-full flex-col gap-5"
      onSubmit={() => {
        setDismissedPreview(false);
        setHideGenerateError(true);
      }}
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
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
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
          {previewPending ? <Spinner /> : null}
          {previewPending ? t("previewing") : t("continue")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("pasteHint")}</p>

      {previewState.error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("previewErrorTitle")}</AlertTitle>
          <AlertDescription>{previewState.error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
