import type { PlanId } from "@/db/schema";

/**
 * Map Stripe subscription.status → app plan.
 * past_due keeps Pro during dunning; canceled/unpaid/incomplete* → free.
 */
export function planFromSubscriptionStatus(
  status: string | null | undefined,
): PlanId {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
      return "pro";
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    case null:
    case undefined:
    case "":
      return "free";
    default:
      return "free";
  }
}

export function isPastDueStatus(status: string | null | undefined): boolean {
  return status === "past_due";
}
