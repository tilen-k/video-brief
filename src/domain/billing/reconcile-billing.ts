import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { createDb, type Db } from "@/db";
import { profiles, type PlanId } from "@/db/schema";
import { isOpenSubscriptionStatus } from "@/domain/billing/compute-profile-patch";
import {
  applySubscriptionToProfile,
  subscriptionSyncFromStripe,
} from "@/domain/billing/sync-subscription";
import { getStripeClient } from "@/lib/stripe/client";
import { errorFields, logger } from "@/lib/logger";

const DEFAULT_STALE_INCOMPLETE_MS = 24 * 60 * 60 * 1000;

const SUBSCRIPTION_PRIORITY: readonly string[] = [
  "active",
  "past_due",
  "trialing",
  "incomplete",
  "unpaid",
  "paused",
];

export function pickPreferredSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  const open = subscriptions.filter((sub) =>
    isOpenSubscriptionStatus(sub.status),
  );
  if (open.length === 0) {
    return null;
  }

  for (const status of SUBSCRIPTION_PRIORITY) {
    const match = open.find((sub) => sub.status === status);
    if (match) {
      return match;
    }
  }

  return open[0] ?? null;
}

export type ReconcileBillingResult = {
  userId: string;
  plan: PlanId;
  updated: boolean;
  canceledStaleIncomplete: number;
};

export async function reconcileBillingFromStripe(
  userId: string,
  deps: {
    db?: Db;
    listSubscriptions?: (customerId: string) => Promise<Stripe.Subscription[]>;
    cancelSubscription?: (id: string) => Promise<Stripe.Subscription>;
    staleIncompleteMs?: number;
  } = {},
): Promise<ReconcileBillingResult> {
  const db = deps.db ?? createDb();
  const staleIncompleteMs =
    deps.staleIncompleteMs ?? DEFAULT_STALE_INCOMPLETE_MS;

  const [row] = await db
    .select({
      plan: profiles.plan,
      stripeCustomerId: profiles.stripeCustomerId,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row?.stripeCustomerId) {
    return {
      userId,
      plan: row?.plan ?? "free",
      updated: false,
      canceledStaleIncomplete: 0,
    };
  }

  const listSubscriptions =
    deps.listSubscriptions ??
    (async (customerId: string) => {
      const stripe = getStripeClient();
      const listed = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      return listed.data;
    });

  const cancelSubscription =
    deps.cancelSubscription ??
    (async (subscriptionId: string) => {
      const stripe = getStripeClient();
      return stripe.subscriptions.cancel(subscriptionId);
    });

  let subscriptions: Stripe.Subscription[];
  try {
    subscriptions = await listSubscriptions(row.stripeCustomerId);
  } catch (error) {
    logger.warn(
      { userId, ...errorFields(error) },
      "billing.reconcile_list_err",
    );
    return {
      userId,
      plan: row.plan,
      updated: false,
      canceledStaleIncomplete: 0,
    };
  }
  let canceledStaleIncomplete = 0;
  const staleBefore = Date.now() - staleIncompleteMs;

  for (const sub of subscriptions) {
    if (sub.status !== "incomplete") {
      continue;
    }
    if (sub.created * 1000 >= staleBefore) {
      continue;
    }
    try {
      await cancelSubscription(sub.id);
      canceledStaleIncomplete += 1;
      logger.info(
        { userId, subscriptionId: sub.id },
        "billing.canceled_stale_incomplete",
      );
    } catch (error) {
      logger.warn(
        { userId, subscriptionId: sub.id, ...errorFields(error) },
        "billing.cancel_stale_incomplete_err",
      );
    }
  }

  if (canceledStaleIncomplete > 0) {
    subscriptions = await listSubscriptions(row.stripeCustomerId);
  }

  const preferred = pickPreferredSubscription(subscriptions);

  if (!preferred) {
    const result = await applySubscriptionToProfile(
      {
        customerId: row.stripeCustomerId,
        subscriptionId: null,
        status: "canceled",
        priceId: null,
        supabaseUserId: userId,
      },
      { db },
    );
    return {
      userId: result.userId,
      plan: result.plan,
      updated: true,
      canceledStaleIncomplete,
    };
  }

  const result = await applySubscriptionToProfile(
    subscriptionSyncFromStripe(preferred),
    { db },
  );

  return {
    userId: result.userId,
    plan: result.plan,
    updated: true,
    canceledStaleIncomplete,
  };
}
