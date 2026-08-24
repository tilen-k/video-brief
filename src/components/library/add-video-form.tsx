"use client";

import { AlertCircleIcon, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  addVideo,
  type AddVideoActionState,
} from "@/lib/actions/library";
import { useTopLoaderOnPending } from "@/components/shared/layout/use-top-loader-on-pending";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const initial: AddVideoActionState = {};

export function AddVideoForm() {
  const t = useTranslations("Library");
  const [state, action, pending] = useActionState(addVideo, initial);
  useTopLoaderOnPending(pending);

  return (
    <form action={action} className="flex w-full flex-col gap-3">
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
      <p className="text-xs text-muted-foreground">{t("pasteHint")}</p>

      {state.error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("addErrorTitle")}</AlertTitle>
          <AlertDescription>
            {state.errorCode === "quota_exceeded"
              ? t("quotaExceeded")
              : state.errorCode === "usage_unavailable"
                ? t("usageUnavailable")
                : state.error}
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
