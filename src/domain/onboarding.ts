import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { profiles } from "@/db/schema";
import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
} from "@/domain/analysis/prefs";
import { DEFAULT_SUMMARY_LANGUAGE } from "@/domain/i18n/summary-languages";
import { resolveSummaryLanguage } from "@/domain/i18n/summary-language";
import type { OnboardingInput } from "@/lib/validations/onboarding";

/**
 * Persist optional tone/length/language defaults and mark onboarding complete.
 * Empty input (skip) still completes onboarding with 50/50 defaults and English.
 */
export async function saveOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<void> {
  const db = createDb();

  await db
    .update(profiles)
    .set({
      summaryTone: input.summaryTone ?? DEFAULT_TONE_SCORE,
      summaryLength: input.summaryLength ?? DEFAULT_LENGTH_SCORE,
      defaultSummaryLanguage: resolveSummaryLanguage(
        input.defaultSummaryLanguage,
        DEFAULT_SUMMARY_LANGUAGE,
      ),
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
}

export async function saveDefaultSummaryLanguage(
  userId: string,
  defaultSummaryLanguage: string,
): Promise<void> {
  const db = createDb();
  await db
    .update(profiles)
    .set({
      defaultSummaryLanguage: resolveSummaryLanguage(defaultSummaryLanguage),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
}

export async function getOnboardingCompleted(userId: string): Promise<boolean> {
  const db = createDb();
  const [row] = await db
    .select({ onboardingCompleted: profiles.onboardingCompleted })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return row?.onboardingCompleted ?? false;
}
