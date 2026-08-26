import type { PlanId } from "@/db/schema";
import { planFromSubscriptionStatus } from "@/domain/billing/plan-from-status";
import { planForStripePriceId } from "@/lib/stripe/config";

export type SubscriptionSyncInput = {
  customerId: string;
  subscriptionId: string | null;
  status: string | null;
  /** Price id from subscription items; used to refuse unknown products. */
  priceId?: string | null;
  /** Prefer metadata when customer row is missing / ambiguous. */
  supabaseUserId?: string | null;
};

export type BillingProfilePatch = {
  plan: PlanId;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
};

/**
 * Pure entitlement mapping used by applySubscriptionToProfile.
 * Fail closed: unknown price never grants Pro (and clears subscription fields).
 */
export function computeBillingProfilePatch(
  input: SubscriptionSyncInput,
): BillingProfilePatch {
  const plan = planFromSubscriptionStatus(input.status);

  if (plan === "pro") {
    const mapped = input.priceId
      ? planForStripePriceId(input.priceId)
      : null;
    if (mapped !== "pro") {
      return {
        plan: "free",
        stripeCustomerId: input.customerId,
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      };
    }
  }

  if (
    plan === "free" &&
    (input.status === "canceled" ||
      input.status === "incomplete_expired" ||
      !input.subscriptionId)
  ) {
    return {
      plan: "free",
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    };
  }

  return {
    plan,
    stripeCustomerId: input.customerId,
    stripeSubscriptionId: input.subscriptionId,
    stripeSubscriptionStatus: input.status,
  };
}

/** Whether a subscription status should block a new Checkout. */
export function isOpenSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "incomplete" ||
    status === "unpaid" ||
    status === "paused"
  );
}
