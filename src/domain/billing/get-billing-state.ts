import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles, type PlanId } from "@/db/schema";
import {
  deriveBillingUiFlags,
  type BillingUiFlags,
} from "@/domain/billing/billing-flags";
import { reconcileBillingFromStripe } from "@/domain/billing/reconcile-billing";
import { errorFields, logger } from "@/lib/logger";

export type BillingProfileState = {
  plan: PlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionStatus: string | null;
};

export type BillingUsageState = BillingProfileState & BillingUiFlags;

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

export async function getBillingStateForUsage(
  userId: string,
  deps: { db?: Db } = {},
): Promise<BillingUsageState> {
  const db = deps.db ?? createDb();
  try {
    await reconcileBillingFromStripe(userId, { db });
  } catch (error) {
    logger.warn(
      { userId, ...errorFields(error) },
      "billing.usage_reconcile_err",
    );
  }
  const profile = await getBillingProfileState(userId, { db });
  return {
    ...profile,
    ...deriveBillingUiFlags(profile),
  };
}
