import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { profiles } from "@/db/schema";
import type { OnboardingInput } from "@/lib/validations/onboarding";

/**
 * Persist optional typed profile fields and mark onboarding complete.
 * Empty input (skip) still completes onboarding.
 */
export async function saveOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<void> {
  const db = createDb();
  const subjects =
    input.subjects && input.subjects.length > 0
      ? [...new Set(input.subjects)]
      : null;

  await db
    .update(profiles)
    .set({
      yearOfBirth: input.yearOfBirth ?? null,
      educationLevel: input.educationLevel ?? null,
      subjects,
      summaryStyle: input.summaryStyle ?? null,
      onboardingCompleted: true,
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
