import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";

export type ConvertProfilePatch = {
  email: string | null;
  displayName: string;
};

/** Sync profiles after anonymous → permanent convert. */
export async function syncProfileAfterConvert(
  userId: string,
  patch: ConvertProfilePatch,
  deps: { db?: Db } = {},
): Promise<void> {
  const db = deps.db ?? createDb();
  await db
    .update(profiles)
    .set({
      email: patch.email,
      displayName: patch.displayName,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
}
