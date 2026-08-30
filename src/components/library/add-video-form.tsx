"use client";

import { AlertCircleIcon, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { previewYoutube } from "@/lib/actions/library";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseYoutubeId } from "@/lib/youtube/parse-url";

import type { VideoConfigurationPreview } from "./video-configuration";

type AddVideoFormProps = {
  /** Bumped by the parent on Cancel so in-flight previews are ignored. */
  epoch: number;
  onPreview: (preview: VideoConfigurationPreview) => void;
  onPreviewStart: () => void;
  onPreviewError: () => void;
};

export function AddVideoForm({
  epoch,
  onPreview,
  onPreviewStart,
  onPreviewError,
}: AddVideoFormProps) {
  const t = useTranslations("Library");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Cancel (and regenerate) bumps epoch → invalidate any in-flight Continue.
  useEffect(() => {
    requestIdRef.current += 1;
  }, [epoch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parseYoutubeId(url) == null) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setError(null);
    onPreviewStart();

    const formData = new FormData();
    formData.set("url", url);
    const result = await previewYoutube({}, formData);

    if (requestId !== requestIdRef.current) {
      return;
    }

    if (result.preview) {
      onPreview(result.preview);
      return;
    }

    onPreviewError();
    setError(result.error ?? t("previewErrorTitle"));
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
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
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="h-11 pl-9"
            aria-label={t("pasteLabel")}
          />
        </div>
        <Button
          type="submit"
          disabled={parseYoutubeId(url) == null ? true : undefined}
          suppressHydrationWarning
          size="lg"
          className="h-11 shrink-0 px-6 sm:min-w-[7rem]"
        >
          {t("continue")}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("previewErrorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
