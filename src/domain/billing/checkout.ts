import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";
import { isOpenSubscriptionStatus } from "@/domain/billing/compute-profile-patch";
import { BillingError } from "@/domain/billing/errors";
import { ensureStripeCustomer } from "@/domain/billing/ensure-customer";
import { getStripeClient } from "@/lib/stripe/client";
import {
  getSiteUrl,
  getStripeProMonthlyPriceId,
} from "@/lib/stripe/config";
import { errorFields, logger } from "@/lib/logger";

export type CheckoutSessionResult = {
  url: string;
};

/**
 * Create a Stripe Checkout Session for Pro monthly. Caller redirects to url.
 */
export async function createCheckoutSessionForPro(
  userId: string,
  deps: { db?: Db; email?: string | null } = {},
): Promise<CheckoutSessionResult> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({
      plan: profiles.plan,
      stripeSubscriptionId: profiles.stripeSubscriptionId,
      stripeSubscriptionStatus: profiles.stripeSubscriptionStatus,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row) {
    throw new BillingError("not_found", "Profile not found.");
  }

  if (row.plan === "pro") {
    throw new BillingError(
      "already_pro",
      "You're already on the Pro plan.",
    );
  }

  if (
    row.stripeSubscriptionId &&
    isOpenSubscriptionStatus(row.stripeSubscriptionStatus)
  ) {
    throw new BillingError(
      "already_pro",
      "A subscription is already in progress. Refresh this page or manage billing.",
    );
  }

  const customerId = await ensureStripeCustomer(userId, {
    db,
    email: deps.email,
  });

  const stripe = getStripeClient();

  try {
    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const open = existing.data.find((sub) =>
      isOpenSubscriptionStatus(sub.status),
    );
    if (open) {
      throw new BillingError(
        "already_pro",
        "A subscription is already in progress. Refresh this page or manage billing.",
      );
    }
  } catch (error) {
    if (error instanceof BillingError) {
      throw error;
    }
    logger.warn(
      { userId, ...errorFields(error) },
      "billing.list_subscriptions_err",
    );
  }

  const siteUrl = getSiteUrl();
  const priceId = getStripeProMonthlyPriceId();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/account/usage?checkout=success`,
      cancel_url: `${siteUrl}/account/usage?checkout=canceled`,
      automatic_tax: { enabled: true },
      customer_update: { address: "auto" },
      metadata: { supabase_user_id: userId },
      subscription_data: {
        metadata: { supabase_user_id: userId },
      },
    });

    if (!session.url) {
      throw new BillingError(
        "billing_unavailable",
        "Couldn't start checkout. Try again.",
      );
    }

    return { url: session.url };
  } catch (error) {
    if (error instanceof BillingError) {
      throw error;
    }
    logger.error(
      { userId, ...errorFields(error) },
      "billing.checkout_session_err",
    );
    throw new BillingError(
      "billing_unavailable",
      "Couldn't start checkout. Try again in a moment.",
    );
  }
}
