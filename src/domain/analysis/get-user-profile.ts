import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles, type SummaryStyle } from "@/db/schema";

export type UserProfile = {
  yearOfBirth: number | null;
  educationLevel: string | null;
  subjects: string[] | null;
  summaryStyle: SummaryStyle | null;
};

export async function getUserProfile(
  userId: string,
  deps: { db?: Db } = {},
): Promise<UserProfile | null> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({
      yearOfBirth: profiles.yearOfBirth,
      educationLevel: profiles.educationLevel,
      subjects: profiles.subjects,
      summaryStyle: profiles.summaryStyle,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    yearOfBirth: row.yearOfBirth,
    educationLevel: row.educationLevel,
    subjects: row.subjects,
    summaryStyle: row.summaryStyle,
  };
}
