import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles, type PlanId } from "@/db/schema";

export type BillingProfileState = {
  plan: PlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionStatus: string | null;
};

export async function getBillingProfileState(
  userId: string,
  deps: { db?: Db } = {},
): Promise<BillingProfileState> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({
      plan: profiles.plan,
      stripeCustomerId: profiles.stripeCustomerId,
      stripeSubscriptionStatus: profiles.stripeSubscriptionStatus,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return {
    plan: row?.plan ?? "free",
    stripeCustomerId: row?.stripeCustomerId ?? null,
    stripeSubscriptionStatus: row?.stripeSubscriptionStatus ?? null,
  };
}
