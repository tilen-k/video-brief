import { describe, expect, it } from "vitest";

import {
  deriveBillingUiFlags,
  isBlockingCheckoutStatus,
  isPaymentRecoveryStatus,
  needsPaymentCompletion,
} from "@/domain/billing/billing-flags";

describe("isPaymentRecoveryStatus", () => {
  it("matches incomplete, unpaid, and paused", () => {
    expect(isPaymentRecoveryStatus("incomplete")).toBe(true);
    expect(isPaymentRecoveryStatus("unpaid")).toBe(true);
    expect(isPaymentRecoveryStatus("paused")).toBe(true);
  });

  it("rejects active and null", () => {
    expect(isPaymentRecoveryStatus("active")).toBe(false);
    expect(isPaymentRecoveryStatus(null)).toBe(false);
  });
});

describe("isBlockingCheckoutStatus", () => {
  it("matches only active and trialing", () => {
    expect(isBlockingCheckoutStatus("active")).toBe(true);
    expect(isBlockingCheckoutStatus("trialing")).toBe(true);
    expect(isBlockingCheckoutStatus("incomplete")).toBe(false);
    expect(isBlockingCheckoutStatus("past_due")).toBe(false);
  });
});

describe("needsPaymentCompletion", () => {
  it("is true for free plan with recovery statuses", () => {
    expect(needsPaymentCompletion("free", "incomplete")).toBe(true);
    expect(needsPaymentCompletion("free", "unpaid")).toBe(true);
  });

  it("is false for pro plan even with incomplete status", () => {
    expect(needsPaymentCompletion("pro", "incomplete")).toBe(false);
  });
});

describe("deriveBillingUiFlags", () => {
  it("shows upgrade for free users without recovery status", () => {
    expect(
      deriveBillingUiFlags({
        plan: "free",
        stripeCustomerId: null,
        stripeSubscriptionStatus: null,
      }),
    ).toEqual({
      needsPaymentCompletion: false,
      showPastDueBanner: false,
      showCompletePayment: false,
      showManageBilling: false,
      showUpgrade: true,
    });
  });

  it("shows complete payment for free + incomplete with customer", () => {
    expect(
      deriveBillingUiFlags({
        plan: "free",
        stripeCustomerId: "cus_1",
        stripeSubscriptionStatus: "incomplete",
      }),
    ).toEqual({
      needsPaymentCompletion: true,
      showPastDueBanner: false,
      showCompletePayment: true,
      showManageBilling: false,
      showUpgrade: false,
    });
  });

  it("shows manage billing for pro users", () => {
    expect(
      deriveBillingUiFlags({
        plan: "pro",
        stripeCustomerId: "cus_1",
        stripeSubscriptionStatus: "active",
      }).showManageBilling,
    ).toBe(true);
  });

  it("shows past due banner and manage billing for pro past_due", () => {
    const flags = deriveBillingUiFlags({
      plan: "pro",
      stripeCustomerId: "cus_1",
      stripeSubscriptionStatus: "past_due",
    });
    expect(flags.showPastDueBanner).toBe(true);
    expect(flags.showManageBilling).toBe(true);
    expect(flags.showUpgrade).toBe(false);
  });
});
