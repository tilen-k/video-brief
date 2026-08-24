import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles, type PlanId } from "@/db/schema";
import { analysisConfig } from "@/domain/analysis/config";

export async function getPlanForUser(
  userId: string,
  deps: { db?: Db } = {},
): Promise<PlanId> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({ plan: profiles.plan })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row?.plan) {
    return "free";
  }

  return row.plan;
}

export function planLimitsFor(plan: PlanId) {
  return analysisConfig.planLimits[plan];
}
