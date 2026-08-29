"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTopLoader } from "nextjs-toploader";
import { useActionState, useEffect } from "react";

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
  preview: VideoConfigurationPreview;
  defaults: VideoConfigurationDefaults;
  plan: PlanId;
  advancedModelEnabled: boolean;
  usageTiers: UsageTiers;
  isGuest: boolean;
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
      {canSelectAdvanced ? (
        <p className="text-xs text-muted-foreground">{advancedHint}</p>
      ) : advancedModelEnabled && !advancedAvailable ? (
        <p className="text-xs text-muted-foreground">{advancedExhaustedHint}</p>
      ) : !advancedModelEnabled ? (
        <p className="text-xs text-muted-foreground">{advancedUnavailableHint}</p>
      ) : null}
      {plan === "free" ? (
        <p className="text-xs text-muted-foreground">{upgradeHint}</p>
      ) : null}
    </fieldset>
  );
}

export function VideoConfiguration({
  preview,
  defaults,
  plan,
  advancedModelEnabled,
  usageTiers,
  isGuest,
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

  const durationLabel = formatDuration(preview.durationSeconds);
  const generateError = generateState.error ?? null;
  const generateErrorCode = generateError ? generateState.errorCode : undefined;
  const blocked = Boolean(preview.tooLong);
  const advancedAvailable =
    advancedModelEnabled &&
    usageTiers.advanced.used < usageTiers.advanced.limit;

  return (
    <form
      key={`${preview.youtubeId}-${defaults.summaryLength}-${defaults.summaryTone}-${defaults.summaryLanguage}-${defaults.familiarity ?? "none"}-${defaults.modelTier}`}
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

        <div className="grid gap-6 sm:grid-cols-2">
          <SummaryLanguageSelect
            id="summaryLanguage"
            name="summaryLanguage"
            label={t("summaryLanguageLabel")}
            defaultValue={defaults.summaryLanguage}
            disabled={isBusy || blocked}
            className="sm:col-span-2"
          />
          <PrefSlider
            id="summaryLength"
            name="summaryLength"
            label={t("lengthLabel")}
            minLabel={t("lengthLow")}
            maxLabel={t("lengthHigh")}
            defaultValue={defaults.summaryLength}
            disabled={isBusy || blocked}
          />
          <PrefSlider
            id="summaryTone"
            name="summaryTone"
            label={t("toneLabel")}
            minLabel={t("toneLow")}
            maxLabel={t("toneHigh")}
            defaultValue={defaults.summaryTone}
            disabled={isBusy || blocked}
          />
          {preview.showFamiliarity ? (
            <PrefSlider
              id="familiarity"
              name="familiarity"
              label={t("familiarityLabel")}
              minLabel={t("familiarityLow")}
              maxLabel={t("familiarityHigh")}
              defaultValue={defaults.familiarity ?? 50}
              disabled={isBusy || blocked}
            />
          ) : null}
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
            disabled={isBusy || blocked}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {t("usageToday", {
            advancedUsed: usageTiers.advanced.used,
            advancedLimit: usageTiers.advanced.limit,
            basicUsed: usageTiers.basic.used,
            basicLimit: usageTiers.basic.limit,
          })}
          {isGuest ? (
            <>
              {" "}
              <Link
                href="/signup"
                className="underline-offset-4 hover:underline"
              >
                {t("guestSignUp")}
              </Link>
            </>
          ) : null}
        </p>

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
            disabled={isBusy || blocked}
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
