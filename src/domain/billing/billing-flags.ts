import type { PlanId } from "@/db/schema";
import { isPastDueStatus } from "@/domain/billing/plan-from-status";

export function isPaymentRecoveryStatus(
  status: string | null | undefined,
): boolean {
  return status === "incomplete" || status === "unpaid" || status === "paused";
}

export function isBlockingCheckoutStatus(
  status: string | null | undefined,
): boolean {
  return status === "active" || status === "trialing";
}

export function needsPaymentCompletion(
  plan: PlanId,
  status: string | null | undefined,
): boolean {
  return plan === "free" && isPaymentRecoveryStatus(status);
}

export type BillingProfileFields = {
  plan: PlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionStatus: string | null;
};

export type BillingUiFlags = {
  needsPaymentCompletion: boolean;
  showPastDueBanner: boolean;
  showCompletePayment: boolean;
  showManageBilling: boolean;
  showUpgrade: boolean;
};

export function deriveBillingUiFlags(
  state: BillingProfileFields,
): BillingUiFlags {
  const needsPaymentCompletionFlag = needsPaymentCompletion(
    state.plan,
    state.stripeSubscriptionStatus,
  );
  const showPastDueBanner = isPastDueStatus(state.stripeSubscriptionStatus);

  return {
    needsPaymentCompletion: needsPaymentCompletionFlag,
    showPastDueBanner,
    showCompletePayment:
      needsPaymentCompletionFlag && state.stripeCustomerId != null,
    showManageBilling: state.plan === "pro" || showPastDueBanner,
    showUpgrade: state.plan === "free" && !needsPaymentCompletionFlag,
  };
}
