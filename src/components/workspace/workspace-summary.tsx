"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { splitSummaryParagraphs } from "@/lib/text/split-summary-paragraphs";

type WorkspaceSummaryProps = {
  title: string;
  body: string | null;
  emptyLabel: string;
};

export function WorkspaceSummary({
  title,
  body,
  emptyLabel,
}: WorkspaceSummaryProps) {
  const t = useTranslations("Workspace");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!body) {
      return;
    }
    await navigator.clipboard.writeText(body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const paragraphs = body ? splitSummaryParagraphs(body) : [];

  return (
    <article className="min-h-0">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-sm tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {body ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label={copied ? t("copiedSummary") : t("copySummary")}
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </Button>
        ) : null}
      </div>
      {body ? (
        <div className="mt-4 max-w-prose space-y-4 text-base leading-relaxed text-foreground">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </article>
  );
}
