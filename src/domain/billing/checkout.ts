import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";
import {
  isBlockingCheckoutStatus,
  isPaymentRecoveryStatus,
} from "@/domain/billing/billing-flags";
import { BillingError } from "@/domain/billing/errors";
import { ensureStripeCustomer } from "@/domain/billing/ensure-customer";
import { isPastDueStatus } from "@/domain/billing/plan-from-status";
import { createBillingPortalSession } from "@/domain/billing/portal";
import {
  pickPreferredSubscription,
  reconcileBillingFromStripe,
} from "@/domain/billing/reconcile-billing";
import { getStripeClient } from "@/lib/stripe/client";
import {
  getSiteUrl,
  getStripeProMonthlyPriceId,
} from "@/lib/stripe/config";
import { errorFields, logger } from "@/lib/logger";

export type CheckoutSessionResult = {
  url: string;
};

function subscriptionInProgressError(): BillingError {
  return new BillingError(
    "subscription_in_progress",
    "A subscription is already in progress. Refresh this page or manage billing.",
  );
}

function shouldRedirectToPortal(
  status: string | null | undefined,
): boolean {
  return isPaymentRecoveryStatus(status) || isPastDueStatus(status);
}

/**
 * Create a Stripe Checkout Session for Pro monthly. Caller redirects to url.
 * Incomplete/unpaid subscriptions redirect to the Customer Portal instead.
 */
export async function createCheckoutSessionForPro(
  userId: string,
  deps: { db?: Db; email?: string | null } = {},
): Promise<CheckoutSessionResult> {
  const db = deps.db ?? createDb();

  try {
    await reconcileBillingFromStripe(userId, { db });
  } catch (error) {
    logger.warn(
      { userId, ...errorFields(error) },
      "billing.checkout_reconcile_err",
    );
  }

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

  if (shouldRedirectToPortal(row.stripeSubscriptionStatus)) {
    return createBillingPortalSession(userId, { db });
  }

  if (
    row.stripeSubscriptionId &&
    isBlockingCheckoutStatus(row.stripeSubscriptionStatus)
  ) {
    throw subscriptionInProgressError();
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
    const preferred = pickPreferredSubscription(existing.data);
    if (preferred) {
      if (isBlockingCheckoutStatus(preferred.status)) {
        throw subscriptionInProgressError();
      }
      if (shouldRedirectToPortal(preferred.status)) {
        return createBillingPortalSession(userId, { db });
      }
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
