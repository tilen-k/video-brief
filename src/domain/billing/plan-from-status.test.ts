import { describe, expect, it } from "vitest";

import {
  isPastDueStatus,
  planFromSubscriptionStatus,
} from "@/domain/billing/plan-from-status";
import { planForStripePriceId } from "@/lib/stripe/config";

describe("planFromSubscriptionStatus", () => {
  it("keeps Pro for active, trialing, and past_due", () => {
    expect(planFromSubscriptionStatus("active")).toBe("pro");
    expect(planFromSubscriptionStatus("trialing")).toBe("pro");
    expect(planFromSubscriptionStatus("past_due")).toBe("pro");
  });

  it("maps canceled and incomplete states to free", () => {
    expect(planFromSubscriptionStatus("canceled")).toBe("free");
    expect(planFromSubscriptionStatus("unpaid")).toBe("free");
    expect(planFromSubscriptionStatus("incomplete")).toBe("free");
    expect(planFromSubscriptionStatus("incomplete_expired")).toBe("free");
    expect(planFromSubscriptionStatus("paused")).toBe("free");
  });

  it("fails closed on unknown or missing status", () => {
    expect(planFromSubscriptionStatus(undefined)).toBe("free");
    expect(planFromSubscriptionStatus(null)).toBe("free");
    expect(planFromSubscriptionStatus("weird")).toBe("free");
  });
});

describe("isPastDueStatus", () => {
  it("detects past_due only", () => {
    expect(isPastDueStatus("past_due")).toBe(true);
    expect(isPastDueStatus("active")).toBe(false);
  });
});

describe("planForStripePriceId", () => {
  it("maps configured Pro price and rejects others", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
    expect(planForStripePriceId("price_pro_test")).toBe("pro");
    expect(planForStripePriceId("price_other")).toBe(null);
  });

  it("returns null when env is missing", () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    expect(planForStripePriceId("price_pro_test")).toBe(null);
  });
});
