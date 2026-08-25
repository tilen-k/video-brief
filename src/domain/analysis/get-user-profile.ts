import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";

export type UserProfile = {
  summaryTone: number;
  summaryLength: number;
};

export async function getUserProfile(
  userId: string,
  deps: { db?: Db } = {},
): Promise<UserProfile | null> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({
      summaryTone: profiles.summaryTone,
      summaryLength: profiles.summaryLength,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    summaryTone: row.summaryTone,
    summaryLength: row.summaryLength,
  };
}
