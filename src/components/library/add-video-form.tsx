"use client";

import { AlertCircleIcon, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";

import {
  previewYoutube,
  type PreviewYoutubeActionState,
} from "@/lib/actions/library";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { parseYoutubeId } from "@/lib/youtube/parse-url";

import type { VideoConfigurationPreview } from "./video-configuration";

const previewInitial: PreviewYoutubeActionState = {};

type AddVideoFormProps = {
  onPreview: (preview: VideoConfigurationPreview) => void;
  onClearPreview: () => void;
  onPreviewPendingChange?: (pending: boolean) => void;
};

export function AddVideoForm({
  onPreview,
  onClearPreview,
  onPreviewPendingChange,
}: AddVideoFormProps) {
  const t = useTranslations("Library");
  const [previewState, previewAction, previewPending] = useActionState(
    previewYoutube,
    previewInitial,
  );
  const [urlDraft, setUrlDraft] = useState("");
  const continueDisabled =
    previewPending || parseYoutubeId(urlDraft) == null;

  useEffect(() => {
    onPreviewPendingChange?.(previewPending);
  }, [previewPending, onPreviewPendingChange]);

  useEffect(() => {
    if (previewState.preview) {
      onPreview(previewState.preview);
    }
  }, [previewState.preview, onPreview]);

  return (
    <form action={previewAction} className="flex w-full flex-col gap-5">
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
            disabled={previewPending}
            required
            value={urlDraft}
            onChange={(event) => {
              setUrlDraft(event.target.value);
              onClearPreview();
            }}
            className="h-11 pl-9"
            aria-label={t("pasteLabel")}
          />
        </div>
        <Button
          type="submit"
          disabled={continueDisabled}
          size="lg"
          className="h-11 shrink-0 px-6 sm:min-w-[7rem]"
        >
          {previewPending ? <Spinner /> : null}
          {previewPending ? null : t("continue")}
        </Button>
      </div>

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
