import { and, eq } from "drizzle-orm";

import { createDb } from "@/db";
import { profiles, userContext } from "@/db/schema";
import {
  onboardingToContextEntries,
  type OnboardingInput,
} from "@/lib/validations/onboarding";

/**
 * Persist optional global context and mark onboarding complete.
 * Empty input (skip) still completes onboarding.
 * Uses Drizzle + DATABASE_URL (prefer Supabase Transaction pooler).
 */
export async function saveOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<void> {
  const db = createDb();
  const entries = onboardingToContextEntries(input);

  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await tx
        .insert(userContext)
        .values({
          userId,
          scope: "global",
          key: entry.key,
          value: entry.value,
        })
        .onConflictDoUpdate({
          target: [userContext.userId, userContext.scope, userContext.key],
          set: {
            value: entry.value,
            updatedAt: new Date(),
          },
        });
    }

    await tx
      .update(profiles)
      .set({
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));
  });
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

export async function getGlobalContext(
  userId: string,
): Promise<Record<string, string>> {
  const db = createDb();
  const rows = await db
    .select({ key: userContext.key, value: userContext.value })
    .from(userContext)
    .where(
      and(eq(userContext.userId, userId), eq(userContext.scope, "global")),
    );

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
