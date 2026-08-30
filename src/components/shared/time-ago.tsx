"use client";

import { useEffect, useMemo, useState } from "react";

const UPDATE_MS = 60_000;

function formatRelativeTime(date: Date, now: Date): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absSeconds < 60) {
    return rtf.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }

  return rtf.format(Math.round(diffMonths / 12), "year");
}

type TimeAgoProps = {
  date: Date | string;
  className?: string;
};

export function TimeAgo({ date, className }: TimeAgoProps) {
  const target = useMemo(
    () => (typeof date === "string" ? new Date(date) : date),
    [date],
  );
  // Relative labels depend on "now" — format only after mount so SSR/client match.
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setLabel(formatRelativeTime(target, new Date()));
    tick();
    const id = window.setInterval(tick, UPDATE_MS);
    return () => window.clearInterval(id);
  }, [target]);

  return (
    <time
      dateTime={target.toISOString()}
      className={className}
      title={target.toISOString()}
    >
      {label ?? ""}
    </time>
  );
}
