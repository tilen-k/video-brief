import { describe, expect, it } from "vitest";

import { computeBillingProfilePatch } from "@/domain/billing/compute-profile-patch";

describe("computeBillingProfilePatch", () => {
  it("sets pro for active subscription with known price", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
    expect(
      computeBillingProfilePatch({
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status: "active",
        priceId: "price_pro_test",
      }),
    ).toEqual({
      plan: "pro",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
    });
  });

  it("keeps pro on past_due", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
    expect(
      computeBillingProfilePatch({
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status: "past_due",
        priceId: "price_pro_test",
      }).plan,
    ).toBe("pro");
  });

  it("fails closed to free on unknown price and clears sub fields", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
    expect(
      computeBillingProfilePatch({
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status: "active",
        priceId: "price_unknown",
      }),
    ).toEqual({
      plan: "free",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    });
  });

  it("fails closed when priceId is missing on active", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
    expect(
      computeBillingProfilePatch({
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status: "active",
        priceId: null,
      }).plan,
    ).toBe("free");
  });

  it("clears subscription ids on canceled", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
    expect(
      computeBillingProfilePatch({
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status: "canceled",
        priceId: "price_pro_test",
      }),
    ).toEqual({
      plan: "free",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    });
  });

  it("retains subscription fields for incomplete", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
    expect(
      computeBillingProfilePatch({
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status: "incomplete",
        priceId: "price_pro_test",
      }),
    ).toEqual({
      plan: "free",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "incomplete",
    });
  });
});
