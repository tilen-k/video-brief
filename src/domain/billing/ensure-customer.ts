import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";
import { BillingError } from "@/domain/billing/errors";
import { getStripeClient } from "@/lib/stripe/client";
import { errorFields, logger } from "@/lib/logger";

export async function ensureStripeCustomer(
  userId: string,
  deps: { db?: Db; email?: string | null } = {},
): Promise<string> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({
      stripeCustomerId: profiles.stripeCustomerId,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row) {
    throw new BillingError("not_found", "Profile not found.");
  }

  if (row.stripeCustomerId) {
    return row.stripeCustomerId;
  }

  const email = deps.email ?? row.email ?? undefined;
  const stripe = getStripeClient();

  try {
    const customer = await stripe.customers.create({
      email: email || undefined,
      metadata: { supabase_user_id: userId },
    });

    await db
      .update(profiles)
      .set({ stripeCustomerId: customer.id })
      .where(eq(profiles.id, userId));

    return customer.id;
  } catch (error) {
    logger.error(
      { userId, ...errorFields(error) },
      "billing.ensure_customer_err",
    );
    throw new BillingError(
      "billing_unavailable",
      "Couldn't set up billing. Try again in a moment.",
    );
  }
}
