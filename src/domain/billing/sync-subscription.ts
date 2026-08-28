import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { createDb, type Db } from "@/db";
import { profiles, type PlanId } from "@/db/schema";
import {
  computeBillingProfilePatch,
  isOpenSubscriptionStatus,
  type SubscriptionSyncInput,
} from "@/domain/billing/compute-profile-patch";
import { BillingError } from "@/domain/billing/errors";
import { pickPreferredSubscription } from "@/domain/billing/reconcile-billing";
import { getStripeClient } from "@/lib/stripe/client";
import { errorFields, logger } from "@/lib/logger";

export type { SubscriptionSyncInput } from "@/domain/billing/compute-profile-patch";

function primaryPriceId(
  subscription: Pick<Stripe.Subscription, "items">,
): string | null {
  const item = subscription.items.data[0];
  return item?.price?.id ?? null;
}

export function subscriptionSyncFromStripe(
  subscription: Stripe.Subscription,
): SubscriptionSyncInput {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  return {
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: primaryPriceId(subscription),
    supabaseUserId: subscription.metadata?.supabase_user_id ?? null,
  };
}

/**
 * Resolve profile primarily by stripe_customer_id.
 * Metadata is a consistency check / backfill only — never overrides a different customer.
 */
async function resolveProfileId(
  db: Db,
  input: SubscriptionSyncInput,
): Promise<string> {
  const [byCustomer] = await db
    .select({
      id: profiles.id,
      stripeCustomerId: profiles.stripeCustomerId,
    })
    .from(profiles)
    .where(eq(profiles.stripeCustomerId, input.customerId))
    .limit(1);

  if (byCustomer) {
    if (
      input.supabaseUserId &&
      input.supabaseUserId !== byCustomer.id
    ) {
      logger.warn(
        {
          userId: byCustomer.id,
          metadataUserId: input.supabaseUserId,
          customerId: input.customerId,
        },
        "billing.metadata_user_mismatch",
      );
    }
    return byCustomer.id;
  }

  // Backfill path: customer not stored yet — only if metadata points at a profile
  // that has no customer, AND Stripe Customer.metadata matches that user.
  if (input.supabaseUserId) {
    const [byMeta] = await db
      .select({
        id: profiles.id,
        stripeCustomerId: profiles.stripeCustomerId,
      })
      .from(profiles)
      .where(eq(profiles.id, input.supabaseUserId))
      .limit(1);

    if (
      byMeta &&
      (byMeta.stripeCustomerId == null ||
        byMeta.stripeCustomerId === input.customerId)
    ) {
      if (byMeta.stripeCustomerId === input.customerId) {
        return byMeta.id;
      }

      try {
        const stripe = getStripeClient();
        const customer = await stripe.customers.retrieve(input.customerId);
        if (customer.deleted) {
          throw new BillingError(
            "not_found",
            "Stripe customer was deleted.",
          );
        }
        const metaUserId = customer.metadata?.supabase_user_id ?? null;
        if (metaUserId === byMeta.id) {
          return byMeta.id;
        }
        logger.warn(
          {
            userId: byMeta.id,
            customerId: input.customerId,
            customerMetaUserId: metaUserId,
          },
          "billing.customer_meta_mismatch_skip_backfill",
        );
      } catch (error) {
        if (error instanceof BillingError) {
          throw error;
        }
        logger.warn(
          { customerId: input.customerId, ...errorFields(error) },
          "billing.customer_retrieve_err",
        );
      }
    }

    if (byMeta?.stripeCustomerId) {
      logger.warn(
        {
          userId: byMeta.id,
          expectedCustomer: byMeta.stripeCustomerId,
          eventCustomer: input.customerId,
        },
        "billing.customer_mismatch_skip_metadata",
      );
    }
  }

  throw new BillingError(
    "not_found",
    "No profile for this Stripe customer.",
  );
}

/**
 * Apply a Stripe subscription snapshot to profiles.plan + stripe_* columns.
 * Fail closed: unknown/missing price on a would-be-pro status → free.
 */
export async function applySubscriptionToProfile(
  input: SubscriptionSyncInput,
  deps: { db?: Db } = {},
): Promise<{ userId: string; plan: PlanId }> {
  const db = deps.db ?? createDb();
  const userId = await resolveProfileId(db, input);
  const patch = computeBillingProfilePatch(input);

  if (
    (input.status === "active" ||
      input.status === "trialing" ||
      input.status === "past_due") &&
    patch.plan === "free" &&
    input.priceId
  ) {
    logger.warn(
      { userId, priceId: input.priceId, status: input.status },
      "billing.unknown_price_fail_closed",
    );
  }

  const [existing] = await db
    .select({ stripeCustomerId: profiles.stripeCustomerId })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  // Never overwrite a different stored customer id.
  const stripeCustomerId =
    existing?.stripeCustomerId &&
    existing.stripeCustomerId !== patch.stripeCustomerId
      ? existing.stripeCustomerId
      : patch.stripeCustomerId;

  if (
    existing?.stripeCustomerId &&
    existing.stripeCustomerId !== patch.stripeCustomerId
  ) {
    logger.warn(
      {
        userId,
        storedCustomer: existing.stripeCustomerId,
        eventCustomer: patch.stripeCustomerId,
      },
      "billing.refuse_customer_overwrite",
    );
  }

  try {
    await db
      .update(profiles)
      .set({
        plan: patch.plan,
        stripeCustomerId,
        stripeSubscriptionId: patch.stripeSubscriptionId,
        stripeSubscriptionStatus: patch.stripeSubscriptionStatus,
      })
      .where(eq(profiles.id, userId));
  } catch (error) {
    logger.error(
      { userId, ...errorFields(error) },
      "billing.apply_subscription_err",
    );
    throw error;
  }

  return { userId, plan: patch.plan };
}

/**
 * Clear subscription for a customer after delete, only if the deleted id
 * matches the stored subscription (or none stored). Otherwise re-sync remaining.
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  deps: {
    db?: Db;
    listOpenSubscriptions?: (customerId: string) => Promise<Stripe.Subscription[]>;
  } = {},
): Promise<{ userId: string; plan: PlanId } | null> {
  const db = deps.db ?? createDb();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [row] = await db
    .select({
      id: profiles.id,
      stripeSubscriptionId: profiles.stripeSubscriptionId,
    })
    .from(profiles)
    .where(eq(profiles.stripeCustomerId, customerId))
    .limit(1);

  if (!row) {
    // Try metadata backfill path via normal apply as canceled
    try {
      return await applySubscriptionToProfile(
        {
          customerId,
          subscriptionId: null,
          status: "canceled",
          priceId: null,
          supabaseUserId: subscription.metadata?.supabase_user_id ?? null,
        },
        { db },
      );
    } catch (error) {
      if (error instanceof BillingError && error.code === "not_found") {
        logger.warn(
          { customerId, subscriptionId: subscription.id },
          "billing.delete_no_profile",
        );
        return null;
      }
      throw error;
    }
  }

  const storedSubId = row.stripeSubscriptionId;
  if (storedSubId && storedSubId !== subscription.id) {
    logger.info(
      {
        userId: row.id,
        deletedSub: subscription.id,
        storedSub: storedSubId,
      },
      "billing.delete_ignored_other_sub",
    );
    return null;
  }

  const listOpen =
    deps.listOpenSubscriptions ??
    (async (cusId: string) => {
      const stripe = getStripeClient();
      const listed = await stripe.subscriptions.list({
        customer: cusId,
        status: "all",
        limit: 10,
      });
      return listed.data.filter((sub) =>
        isOpenSubscriptionStatus(sub.status),
      );
    });

  const remaining = (await listOpen(customerId)).filter(
    (sub) => sub.id !== subscription.id,
  );

  if (remaining.length > 0) {
    const preferred = pickPreferredSubscription(remaining);
    if (preferred) {
      return applySubscriptionToProfile(subscriptionSyncFromStripe(preferred), {
        db,
      });
    }
  }

  return applySubscriptionToProfile(
    {
      customerId,
      subscriptionId: null,
      status: "canceled",
      priceId: null,
      supabaseUserId: row.id,
    },
    { db },
  );
}

/** @deprecated Prefer handleSubscriptionDeleted — kept for clear API name. */
export async function clearSubscriptionForCustomer(
  customerId: string,
  deps: { db?: Db; supabaseUserId?: string | null } = {},
): Promise<{ userId: string; plan: PlanId }> {
  return applySubscriptionToProfile(
    {
      customerId,
      subscriptionId: null,
      status: "canceled",
      priceId: null,
      supabaseUserId: deps.supabaseUserId ?? null,
    },
    { db: deps.db },
  );
}
