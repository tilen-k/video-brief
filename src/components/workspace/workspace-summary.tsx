"use client";

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
  return (
    <article className="min-h-0">
      <h2 className="font-heading text-sm tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {body ? (
        <div className="mt-4 whitespace-pre-wrap font-heading text-base leading-relaxed text-foreground sm:text-lg">
          {body}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </article>
  );
}
