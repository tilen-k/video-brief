import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";

/** Display name from profiles for shell chrome (guest or permanent). */
export async function getProfileShellLabel(
  userId: string,
  deps: { db?: Db } = {},
): Promise<string | null> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return row?.displayName ?? null;
}
