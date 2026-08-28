import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";
import {
  DEFAULT_SUMMARY_LANGUAGE,
  type SummaryLanguageCode,
} from "@/domain/i18n/summary-languages";
import {
  ensureDefaultSummaryLanguage,
  resolveSummaryLanguage,
  summaryLanguageSchema,
} from "@/domain/i18n/summary-language";

export type UserProfile = {
  summaryTone: number;
  summaryLength: number;
  defaultSummaryLanguage: SummaryLanguageCode;
};

export async function getUserProfile(
  userId: string,
  deps: { db?: Db; acceptLanguage?: string | null } = {},
): Promise<UserProfile | null> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({
      summaryTone: profiles.summaryTone,
      summaryLength: profiles.summaryLength,
      defaultSummaryLanguage: profiles.defaultSummaryLanguage,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  const parsedDefault = summaryLanguageSchema.safeParse(row.defaultSummaryLanguage);
  const defaultSummaryLanguage = parsedDefault.success
    ? parsedDefault.data
    : await ensureDefaultSummaryLanguage(userId, deps.acceptLanguage, { db });

  return {
    summaryTone: row.summaryTone,
    summaryLength: row.summaryLength,
    defaultSummaryLanguage: resolveSummaryLanguage(
      defaultSummaryLanguage,
      DEFAULT_SUMMARY_LANGUAGE,
    ),
  };
}
