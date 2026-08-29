"use client";

import Image from "next/image";
import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTopLoader } from "nextjs-toploader";
import { useActionState, useEffect, type ChangeEvent } from "react";

import {
  generateVideo,
  type GenerateVideoActionState,
} from "@/lib/actions/library";
import type { ModelTier, PlanId } from "@/db/schema";
import type { TierUsage } from "@/domain/usage";
import { SummaryLanguageSelect } from "@/components/shared/summary-language-select";
import { LoadingDots } from "@/components/shared/status/loading-dots";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  summaryLanguage: string;
  familiarity: number | null;
  modelTier: ModelTier;
};

type UsageTiers = {
  basic: TierUsage;
  advanced: TierUsage;
};

type VideoConfigurationProps = {
  preview: VideoConfigurationPreview | null;
  /** True only while a Continue request is in flight. */
  previewLoading: boolean;
  defaults: VideoConfigurationDefaults;
  plan: PlanId;
  advancedModelEnabled: boolean;
  usageTiers: UsageTiers;
  formKey: string;
  onDefaultsChange?: (patch: Partial<VideoConfigurationDefaults>) => void;
  onClear: () => void;
};

function PrefSlider({
  id,
  name,
  label,
  minLabel,
  maxLabel,
  defaultValue,
  value,
  onValueChange,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  minLabel: string;
  maxLabel: string;
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  disabled: boolean;
}) {
  const controlled = value != null && onValueChange != null;
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
        {...(controlled
          ? {
              value,
              onChange: (event: ChangeEvent<HTMLInputElement>) => {
                onValueChange(Number(event.target.value));
              },
            }
          : { defaultValue })}
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

function ModelTierSelector({
  label,
  basicLabel,
  advancedLabel,
  advancedHint,
  advancedExhaustedHint,
  advancedUnavailableHint,
  upgradeHint,
  defaultValue,
  plan,
  advancedModelEnabled,
  advancedAvailable,
  disabled,
}: {
  label: string;
  basicLabel: string;
  advancedLabel: string;
  advancedHint: string;
  advancedExhaustedHint: string;
  advancedUnavailableHint: string;
  upgradeHint: string;
  defaultValue: ModelTier;
  plan: PlanId;
  advancedModelEnabled: boolean;
  advancedAvailable: boolean;
  disabled: boolean;
}) {
  const canSelectAdvanced = advancedModelEnabled && advancedAvailable;

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-50">
          <input
            type="radio"
            name="modelTier"
            value="basic"
            defaultChecked={defaultValue === "basic" || !canSelectAdvanced}
            disabled={disabled}
            className="accent-foreground"
          />
          <span>{basicLabel}</span>
        </label>
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-50",
            !advancedModelEnabled && "opacity-50",
          )}
        >
          <input
            type="radio"
            name="modelTier"
            value="advanced"
            defaultChecked={defaultValue === "advanced" && canSelectAdvanced}
            disabled={disabled || !canSelectAdvanced}
            className="accent-foreground"
          />
          <span>{advancedLabel}</span>
        </label>
      </div>
      {canSelectAdvanced && advancedHint ? (
        <p className="text-xs text-muted-foreground">{advancedHint}</p>
      ) : advancedModelEnabled && !advancedAvailable ? (
        <p className="text-xs text-muted-foreground">{advancedExhaustedHint}</p>
      ) : !advancedModelEnabled ? (
        <p className="text-xs text-muted-foreground">{advancedUnavailableHint}</p>
      ) : null}
      {plan === "free" && upgradeHint ? (
        <p className="text-xs text-muted-foreground">{upgradeHint}</p>
      ) : null}
    </fieldset>
  );
}

function PreviewHeaderSkeleton() {
  return (
    <div className="flex gap-4" aria-hidden>
      <Skeleton className="h-20 w-36 shrink-0 rounded-none" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

function PrefSliderSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

function CustomConfigSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2" aria-hidden>
      <PrefSliderSkeleton />
      <PrefSliderSkeleton />
    </div>
  );
}

export function VideoConfiguration({
  preview,
  previewLoading,
  defaults,
  plan,
  advancedModelEnabled,
  usageTiers,
  formKey,
  onDefaultsChange,
  onClear,
}: VideoConfigurationProps) {
  const t = useTranslations("Library");
  const router = useRouter();
  const loader = useTopLoader();
  const [generateState, generateAction, generatePending] = useActionState(
    generateVideo,
    generateInitial,
  );

  const isBusy =
    generatePending || Boolean(generateState.redirectTo);

  useEffect(() => {
    if (!generateState.redirectTo) {
      return;
    }
    loader.start();
    router.push(generateState.redirectTo);
  }, [generateState.redirectTo, loader, router]);

  const durationLabel = preview
    ? formatDuration(preview.durationSeconds)
    : null;
  const generateError = generateState.error ?? null;
  const generateErrorCode = generateError ? generateState.errorCode : undefined;
  const blocked = Boolean(preview?.tooLong);
  const advancedAvailable =
    advancedModelEnabled &&
    usageTiers.advanced.used < usageTiers.advanced.limit;
  const prefsDisabled = isBusy || blocked;
  const canGenerate = preview != null && !isBusy && !blocked;

  return (
    <form
      key={formKey}
      action={generateAction}
      className="flex w-full flex-col gap-8"
    >
      <div
        className={
          isBusy ? "pointer-events-none space-y-8 opacity-50" : "space-y-8"
        }
      >
        <h2 className="font-heading text-base tracking-tight">
          {t("configureTitle")}
        </h2>

        {preview ? (
          <input type="hidden" name="youtubeId" value={preview.youtubeId} />
        ) : null}

        {previewLoading ? (
          <div aria-busy="true" aria-label={t("previewing")}>
            <PreviewHeaderSkeleton />
          </div>
        ) : preview ? (
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
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <SummaryLanguageSelect
            id="summaryLanguage"
            name="summaryLanguage"
            label={t("summaryLanguageLabel")}
            defaultValue={defaults.summaryLanguage}
            disabled={prefsDisabled}
          />
          <ModelTierSelector
            label={t("modelLabel")}
            basicLabel={t("modelBasic")}
            advancedLabel={t("modelAdvanced")}
            advancedHint={t("modelAdvancedHint")}
            advancedExhaustedHint={t("modelAdvancedExhaustedHint")}
            advancedUnavailableHint={t("modelAdvancedUnavailableHint")}
            upgradeHint={t("modelUpgradeHint")}
            defaultValue={defaults.modelTier}
            plan={plan}
            advancedModelEnabled={advancedModelEnabled}
            advancedAvailable={advancedAvailable}
            disabled={prefsDisabled}
          />
          <PrefSlider
            id="summaryLength"
            name="summaryLength"
            label={t("lengthLabel")}
            minLabel={t("lengthLow")}
            maxLabel={t("lengthHigh")}
            defaultValue={defaults.summaryLength}
            disabled={prefsDisabled}
          />
          <PrefSlider
            id="summaryTone"
            name="summaryTone"
            label={t("toneLabel")}
            minLabel={t("toneLow")}
            maxLabel={t("toneHigh")}
            defaultValue={defaults.summaryTone}
            disabled={prefsDisabled}
          />
        </div>

        {previewLoading ? (
          <div aria-busy="true" aria-label={t("previewing")}>
            <CustomConfigSkeleton />
          </div>
        ) : preview?.showFamiliarity ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <PrefSlider
              id="familiarity"
              name="familiarity"
              label={t("familiarityLabel")}
              minLabel={t("familiarityLow")}
              maxLabel={t("familiarityHigh")}
              value={defaults.familiarity ?? 50}
              onValueChange={(value) =>
                onDefaultsChange?.({ familiarity: value })
              }
              disabled={isBusy || blocked}
            />
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {t("usageToday", {
            advancedUsed: usageTiers.advanced.used,
            advancedLimit: usageTiers.advanced.limit,
            basicUsed: usageTiers.basic.used,
            basicLimit: usageTiers.basic.limit,
          })}
        </p>

        {preview?.tooLong ? (
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
                : generateErrorCode === "rate_limit_exceeded"
                  ? t("rateLimitExceeded")
                  : generateErrorCode === "usage_unavailable"
                    ? t("usageUnavailable")
                    : generateErrorCode === "too_long"
                      ? t("tooLongBody")
                      : generateError}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={!canGenerate}
            size="lg"
            className="h-11 min-w-[7rem] px-6"
          >
            {isBusy ? t("generating") : t("generate")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={isBusy}
            className="h-11 px-6"
            onClick={onClear}
          >
            {t("clearPreview")}
          </Button>
          {isBusy ? (
            <LoadingDots
              label={t("generating")}
              className="text-muted-foreground"
            />
          ) : null}
        </div>
      </div>
    </form>
  );
}
