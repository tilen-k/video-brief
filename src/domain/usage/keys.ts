import type { ModelTier } from "@/db/schema";

export const USAGE_QUOTA_KEY_DELIMITER = "|";

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

/** Seconds until end of UTC day + 1 day grace. */
export function dailyKeyTtlSeconds(at: Date = new Date()): number {
  const ends = utcDayPeriodEndsAt(at).getTime();
  const graceMs = 24 * 60 * 60 * 1000;
  return Math.max(60, Math.ceil((ends + graceMs - at.getTime()) / 1000));
}

export function hourlyKeyTtlSeconds(): number {
  return 2 * 60 * 60;
}

export function globalDailyKeyTtlSeconds(): number {
  return 2 * 24 * 60 * 60;
}

export function userDailyUsageKey(
  userId: string,
  tier: ModelTier,
  at: Date = new Date(),
): string {
  return `vb:usage:u:${userId}:${tier}:d:${utcDayPeriodKey(at)}`;
}

export function globalHourlyUsageKey(
  tier: ModelTier,
  at: Date = new Date(),
): string {
  return `vb:usage:g:${tier}:h:${utcHourPeriodKey(at)}`;
}

export function globalDailyUsageKey(
  tier: ModelTier,
  at: Date = new Date(),
): string {
  return `vb:usage:g:${tier}:d:${utcDayPeriodKey(at)}`;
}

export function ipDailyUsageKey(
  ipHash: string,
  tier: ModelTier,
  at: Date = new Date(),
): string {
  return `vb:usage:ip:${ipHash}:${tier}:d:${utcDayPeriodKey(at)}`;
}

export function encodeUsageQuotaKeys(keys: string[]): string {
  return keys.join(USAGE_QUOTA_KEY_DELIMITER);
}

export function decodeUsageQuotaKeys(encoded: string): string[] {
  if (!encoded) {
    return [];
  }
  return encoded.split(USAGE_QUOTA_KEY_DELIMITER);
}
