export function utcDayPeriodKey(at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function utcHourPeriodKey(at: Date = new Date()): string {
  return `${utcDayPeriodKey(at)}${String(at.getUTCHours()).padStart(2, "0")}`;
}

/** Exclusive start of next UTC day. */
export function utcDayPeriodEndsAt(at: Date = new Date()): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1),
  );
}
