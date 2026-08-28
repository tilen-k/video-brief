import { eq } from "drizzle-orm";
import { z } from "zod";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";
import {
  DEFAULT_SUMMARY_LANGUAGE,
  SUMMARY_LANGUAGE_CODES,
  type SummaryLanguageCode,
} from "@/domain/i18n/summary-languages";

export const summaryLanguageSchema = z.enum(SUMMARY_LANGUAGE_CODES);

export function normalizeLanguageCode(value: string | undefined | null): string | null {
  if (!value?.trim()) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  const primary = normalized.split("-")[0];
  return primary || null;
}

/** Map supported summary codes to YouTube caption track codes. */
const YOUTUBE_CAPTION_ALIASES: Record<string, string[]> = {
  fil: ["tl"],
  he: ["iw"],
  nb: ["no"],
};

export function captionLanguageCandidates(code: string): string[] {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) {
    return [];
  }
  const aliases = YOUTUBE_CAPTION_ALIASES[normalized] ?? [];
  return [normalized, ...aliases];
}

export function languageCodesMatch(
  trackCode: string | undefined,
  targetCode: string,
): boolean {
  const track = normalizeLanguageCode(trackCode);
  if (!track) {
    return false;
  }
  return captionLanguageCandidates(targetCode).some((candidate) => candidate === track);
}

/** First supported language from Accept-Language, else English. */
export function inferSummaryLanguageFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): SummaryLanguageCode {
  if (!acceptLanguage?.trim()) {
    return DEFAULT_SUMMARY_LANGUAGE;
  }

  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().replaceAll("_", "-");
    if (!tag) {
      continue;
    }
    const primary = tag.split("-")[0];
    if (primary && summaryLanguageSchema.safeParse(primary).success) {
      return primary as SummaryLanguageCode;
    }
  }

  return DEFAULT_SUMMARY_LANGUAGE;
}

export async function ensureDefaultSummaryLanguage(
  userId: string,
  acceptLanguage: string | null | undefined,
  deps: { db?: Db } = {},
): Promise<SummaryLanguageCode> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({ defaultSummaryLanguage: profiles.defaultSummaryLanguage })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (row?.defaultSummaryLanguage) {
    const parsed = summaryLanguageSchema.safeParse(row.defaultSummaryLanguage);
    if (parsed.success) {
      return parsed.data;
    }
  }

  const inferred = inferSummaryLanguageFromAcceptLanguage(acceptLanguage);
  await db
    .update(profiles)
    .set({
      defaultSummaryLanguage: inferred,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));

  return inferred;
}

export function resolveSummaryLanguage(
  value: string | null | undefined,
  fallback: string = DEFAULT_SUMMARY_LANGUAGE,
): SummaryLanguageCode {
  const parsed = summaryLanguageSchema.safeParse(value);
  return parsed.success ? parsed.data : summaryLanguageSchema.parse(fallback);
}
