"use client";

import Image from "next/image";
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
import {
  durationExceedsTier,
} from "@/domain/usage/duration";
import {
  evaluateGenerateGate,
  type GenerateGateReason,
} from "@/domain/usage/generate-gate";
import type { TierUsage } from "@/domain/usage/quota";
import { PrefSlider } from "@/components/shared/pref-slider";
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

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds < 0) {
    return null;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function initialSelectedTier(input: {
  defaults: ModelTier;
  advancedAvailable: boolean;
  basicAvailable: boolean;
  durationSeconds: number | null;
}): ModelTier {
  if (!input.advancedAvailable) {
    return "basic";
  }
  if (!input.basicAvailable) {
    return "advanced";
  }
  const exceedsBasic =
    input.durationSeconds != null &&
    durationExceedsTier("basic", input.durationSeconds);
  const exceedsAdvanced =
    input.durationSeconds != null &&
    durationExceedsTier("advanced", input.durationSeconds);
  if (exceedsBasic && !exceedsAdvanced) {
    return "advanced";
  }
  if (input.defaults === "advanced") {
    return "advanced";
  }
  return "basic";
}

function ModelTierSelector({
  label,
  basicLabel,
  advancedLabel,
  durationHint,
  advancedExhaustedHint,
  advancedUnavailableHint,
  upgradeHint,
  value,
  onChange,
  plan,
  advancedModelEnabled,
  advancedAvailable,
  canSelectBasic,
  canSelectAdvanced,
  disabled,
}: {
  label: string;
  basicLabel: string;
  advancedLabel: string;
  durationHint: string;
  advancedExhaustedHint: string;
  advancedUnavailableHint: string;
  upgradeHint: string;
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
  plan: PlanId;
  advancedModelEnabled: boolean;
  advancedAvailable: boolean;
  canSelectBasic: boolean;
  canSelectAdvanced: boolean;
  disabled: boolean;
}) {
  const basicDisabled = disabled || !canSelectBasic;
  const advancedDisabled = disabled || !canSelectAdvanced;

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <label
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm",
            basicDisabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer",
          )}
        >
          <input
            type="radio"
            name="modelTierUi"
            value="basic"
            checked={value === "basic"}
            onChange={() => onChange("basic")}
            disabled={basicDisabled}
            className="accent-foreground"
          />
          <span>{basicLabel}</span>
        </label>
        <label
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm",
            advancedDisabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer",
          )}
        >
          <input
            type="radio"
            name="modelTierUi"
            value="advanced"
            checked={value === "advanced"}
            onChange={() => onChange("advanced")}
            disabled={advancedDisabled}
            className="accent-foreground"
          />
          <span>{advancedLabel}</span>
        </label>
      </div>
      {durationHint ? (
        <p className="text-xs text-muted-foreground">{durationHint}</p>
      ) : null}
      {advancedModelEnabled && !advancedAvailable ? (
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
      <div className="flex h-8 items-center">
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
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

  const advancedAvailable =
    advancedModelEnabled &&
    usageTiers.advanced.used < usageTiers.advanced.limit;
  const basicAvailable = usageTiers.basic.used < usageTiers.basic.limit;

  const durationSeconds = preview?.durationSeconds ?? null;
  const exceedsBasic =
    durationSeconds != null && durationExceedsTier("basic", durationSeconds);
  const exceedsAdvanced =
    durationSeconds != null && durationExceedsTier("advanced", durationSeconds);
  const canSelectBasic = basicAvailable && !exceedsBasic;
  const canSelectAdvanced =
    advancedModelEnabled && advancedAvailable && !exceedsAdvanced;

  const selectedTier = initialSelectedTier({
    defaults: defaults.modelTier,
    advancedAvailable,
    basicAvailable,
    durationSeconds,
  });

  const isBusy = generatePending || Boolean(generateState.redirectTo);

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

  const gate = preview
    ? evaluateGenerateGate({
        durationSeconds: preview.durationSeconds,
        selectedTier,
        basicAvailable,
        advancedAvailable,
      })
    : { ok: true as const };

  const prefsDisabled = isBusy;
  const canGenerate =
    preview != null && !previewLoading && !isBusy && gate.ok;

  function handleTierChange(tier: ModelTier) {
    onDefaultsChange?.({ modelTier: tier });
  }

  function gateDescription(reason: GenerateGateReason): string {
    switch (reason) {
      case "both_exhausted":
        return t("quotaExceeded");
      case "selected_exhausted":
        return selectedTier === "advanced"
          ? t("modelAdvancedExhaustedHint")
          : t("quotaExceededBasic");
      case "too_long": {
        const exceedsAdvanced =
          preview?.durationSeconds != null &&
          durationExceedsTier("advanced", preview.durationSeconds);
        return exceedsAdvanced
          ? t("tooLongBodyAdvanced")
          : t("tooLongBodyBasic");
      }
      case "needs_advanced":
        return t("needsAdvanced");
      case "unknown_duration":
        return t("unknownDuration");
    }
  }

  function generateErrorDescription(): string {
    if (generateErrorCode === "quota_exceeded") {
      return generateError ?? t("quotaExceeded");
    }
    if (generateErrorCode === "rate_limit_exceeded") {
      return t("rateLimitExceeded");
    }
    if (generateErrorCode === "usage_unavailable") {
      return t("usageUnavailable");
    }
    if (generateErrorCode === "too_long") {
      const exceedsAdvanced =
        preview?.durationSeconds != null &&
        durationExceedsTier("advanced", preview.durationSeconds);
      return exceedsAdvanced
        ? t("tooLongBodyAdvanced")
        : t("tooLongBodyBasic");
    }
    if (generateErrorCode === "transcript_too_large") {
      return t("transcriptTooLarge");
    }
    return generateError ?? "";
  }

  const showGateAlert = preview != null && !previewLoading && !gate.ok;

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
        <input type="hidden" name="modelTier" value={selectedTier} />

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
          <ModelTierSelector
            label={t("modelLabel")}
            basicLabel={t("modelBasic")}
            advancedLabel={t("modelAdvanced")}
            durationHint={t("modelDurationHint")}
            advancedExhaustedHint={t("modelAdvancedExhaustedHint")}
            advancedUnavailableHint={t("modelAdvancedUnavailableHint")}
            upgradeHint={t("modelUpgradeHint")}
            value={selectedTier}
            onChange={handleTierChange}
            plan={plan}
            advancedModelEnabled={advancedModelEnabled}
            advancedAvailable={advancedAvailable}
            canSelectBasic={canSelectBasic}
            canSelectAdvanced={canSelectAdvanced}
            disabled={prefsDisabled}
          />
          <SummaryLanguageSelect
            id="summaryLanguage"
            name="summaryLanguage"
            label={t("summaryLanguageLabel")}
            defaultValue={defaults.summaryLanguage}
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
              disabled={isBusy}
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

        {showGateAlert && !gate.ok ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>
              {gate.reason === "too_long" ||
              gate.reason === "unknown_duration" ||
              gate.reason === "needs_advanced"
                ? t("tooLongTitle")
                : t("quotaTitle")}
            </AlertTitle>
            <AlertDescription>
              {gateDescription(gate.reason)}
            </AlertDescription>
          </Alert>
        ) : null}

        {generateError ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("generateErrorTitle")}</AlertTitle>
            <AlertDescription>{generateErrorDescription()}</AlertDescription>
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
