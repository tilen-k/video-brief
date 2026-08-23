"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Panel } from "@/components/shared/list/panel";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import { FAMILIARITY_LEVELS, SUMMARY_STYLES } from "@/domain/analysis/prefs";
import { useSubmitVideoPrefs } from "@/hooks/use-submit-video-prefs";
import type { FamiliarityLevel, SummaryStyle } from "@/lib/validations/onboarding-options";

type VideoPrefsFormProps = {
  video: WorkspaceVideo;
};

function prefsFromForm(form: HTMLFormElement): {
  familiarity?: FamiliarityLevel;
  summaryLength?: SummaryStyle;
} {
  const data = new FormData(form);
  const familiarity = data.get("familiarity");
  const summaryLength = data.get("summaryLength");
  return {
    ...(typeof familiarity === "string" && familiarity.length > 0
      ? { familiarity: familiarity as FamiliarityLevel }
      : {}),
    ...(typeof summaryLength === "string" && summaryLength.length > 0
      ? { summaryLength: summaryLength as SummaryStyle }
      : {}),
  };
}

export function VideoPrefsForm({ video }: VideoPrefsFormProps) {
  const t = useTranslations("Workspace");
  const { mutate, isPending } = useSubmitVideoPrefs(video.userVideoId);
  const topic = video.classification?.topic ?? t("prefsTopicFallback");

  return (
    <Panel>
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          mutate(prefsFromForm(event.currentTarget));
        }}
      >
        <div className="space-y-1">
          <h2 className="font-heading text-lg tracking-tight">
            {t("prefsTitle")}
          </h2>
          <FieldDescription>{t("prefsHint")}</FieldDescription>
        </div>

        <FieldGroup>
          {video.askFamiliarity ? (
            <Field>
              <FieldLabel htmlFor="familiarity">
                {t("prefsFamiliarity", { topic })}
              </FieldLabel>
              <NativeSelect
                id="familiarity"
                name="familiarity"
                defaultValue={video.familiarity ?? ""}
                disabled={isPending}
                className="w-full"
              >
                <NativeSelectOption value="">
                  {t("prefsSkipOption")}
                </NativeSelectOption>
                {FAMILIARITY_LEVELS.map((level) => (
                  <NativeSelectOption key={level} value={level}>
                    {t(`familiarityLevels.${level}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}

          {video.askLength ? (
            <Field>
              <FieldLabel htmlFor="summaryLength">{t("prefsLength")}</FieldLabel>
              <NativeSelect
                id="summaryLength"
                name="summaryLength"
                defaultValue={video.summaryLength ?? video.defaultLength}
                disabled={isPending}
                className="w-full"
              >
                {SUMMARY_STYLES.map((style) => (
                  <NativeSelectOption key={style} value={style}>
                    {t(`lengthLevels.${style}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
        </FieldGroup>

        <Field orientation="horizontal" className="flex-wrap sm:flex-nowrap">
          <Button type="submit" disabled={isPending} className="sm:flex-1">
            {isPending ? <Spinner /> : null}
            {t("prefsContinue")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => mutate({})}
          >
            {t("prefsSkip")}
          </Button>
        </Field>
      </form>
    </Panel>
  );
}
