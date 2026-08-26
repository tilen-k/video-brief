"use client";

import Image from "next/image";
import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  generateVideo,
  type GenerateVideoActionState,
} from "@/lib/actions/library";
import { useTopLoaderOnPending } from "@/components/shared/layout/use-top-loader-on-pending";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const generateInitial: GenerateVideoActionState = {};

export type VideoConfigurationPreview = {
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  youtubeCategoryId: string | null;
  showFamiliarity: boolean;
  tooLong?: boolean;
};

export type VideoConfigurationDefaults = {
  summaryLength: number;
  summaryTone: number;
  familiarity: number | null;
};

type VideoConfigurationProps = {
  preview: VideoConfigurationPreview;
  defaults: VideoConfigurationDefaults;
  onClear: () => void;
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

export function VideoConfiguration({
  preview,
  defaults,
  onClear,
}: VideoConfigurationProps) {
  const t = useTranslations("Library");
  const [generateState, generateAction, generatePending] = useActionState(
    generateVideo,
    generateInitial,
  );
  useTopLoaderOnPending(generatePending);

  const durationLabel = formatDuration(preview.durationSeconds);
  const generateError = generateState.error ?? null;
  const generateErrorCode = generateError ? generateState.errorCode : undefined;
  const blocked = Boolean(preview.tooLong);

  return (
    <form
      key={`${preview.youtubeId}-${defaults.summaryLength}-${defaults.summaryTone}-${defaults.familiarity ?? "none"}`}
      action={generateAction}
      className="flex w-full flex-col gap-5 border-t border-border pt-5"
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
          defaultValue={defaults.summaryLength}
          disabled={generatePending || blocked}
        />
        <PrefSlider
          id="summaryTone"
          name="summaryTone"
          label={t("toneLabel")}
          minLabel={t("toneLow")}
          maxLabel={t("toneHigh")}
          defaultValue={defaults.summaryTone}
          disabled={generatePending || blocked}
        />
        {preview.showFamiliarity ? (
          <PrefSlider
            id="familiarity"
            name="familiarity"
            label={t("familiarityLabel")}
            minLabel={t("familiarityLow")}
            maxLabel={t("familiarityHigh")}
            defaultValue={defaults.familiarity ?? 50}
            disabled={generatePending || blocked}
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
          disabled={generatePending || blocked}
          size="lg"
          className="h-11 px-6"
        >
          {generatePending ? <Spinner /> : null}
          {generatePending ? t("generating") : t("generate")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={generatePending}
          onClick={onClear}
        >
          {t("clearPreview")}
        </Button>
      </div>
    </form>
  );
}
