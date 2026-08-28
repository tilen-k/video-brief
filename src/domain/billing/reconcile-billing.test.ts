import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mockApply = vi.fn();

vi.mock("@/domain/billing/sync-subscription", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/billing/sync-subscription")>();
  return {
    ...actual,
    applySubscriptionToProfile: (...args: unknown[]) => mockApply(...args),
  };
});

import {
  pickPreferredSubscription,
  reconcileBillingFromStripe,
} from "@/domain/billing/reconcile-billing";

function sub(
  partial: Partial<Stripe.Subscription> & {
    id: string;
    status: Stripe.Subscription.Status;
  },
): Stripe.Subscription {
  return {
    created: Math.floor(Date.now() / 1000),
    customer: "cus_1",
    items: {
      data: [{ price: { id: "price_pro_test" } }],
    } as Stripe.Subscription["items"],
    ...partial,
  } as Stripe.Subscription;
}

function profileSelect(row: Record<string, unknown> | undefined) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    }),
  };
}

describe("pickPreferredSubscription", () => {
  it("prefers active over incomplete", () => {
    const active = sub({ id: "sub_active", status: "active" });
    const incomplete = sub({ id: "sub_inc", status: "incomplete" });
    expect(pickPreferredSubscription([incomplete, active])).toBe(active);
  });

  it("returns null when no open subscriptions", () => {
    expect(
      pickPreferredSubscription([
        sub({ id: "sub_1", status: "canceled" }),
      ]),
    ).toBeNull();
  });
});

describe("reconcileBillingFromStripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApply.mockImplementation(async (input: { status: string | null }) => ({
      userId: "user_1",
      plan: input.status === "active" ? "pro" : "free",
    }));
  });

  it("returns without Stripe calls when no customer id", async () => {
    const listSubscriptions = vi.fn();
    const result = await reconcileBillingFromStripe("user_1", {
      db: profileSelect({
        plan: "free",
        stripeCustomerId: null,
      }) as never,
      listSubscriptions,
    });

    expect(result.updated).toBe(false);
    expect(listSubscriptions).not.toHaveBeenCalled();
  });

  it("syncs active subscription to pro", async () => {
    const active = sub({ id: "sub_active", status: "active" });
    const listSubscriptions = vi.fn().mockResolvedValue([active]);

    const result = await reconcileBillingFromStripe("user_1", {
      db: profileSelect({
        plan: "free",
        stripeCustomerId: "cus_1",
      }) as never,
      listSubscriptions,
    });

    expect(mockApply).toHaveBeenCalled();
    expect(result.plan).toBe("pro");
    expect(result.updated).toBe(true);
  });

  it("cancels stale incomplete subscriptions before sync", async () => {
    const staleCreated = Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000);
    const stale = sub({
      id: "sub_stale",
      status: "incomplete",
      created: staleCreated,
    });

    const listSubscriptions = vi
      .fn()
      .mockResolvedValueOnce([stale])
      .mockResolvedValueOnce([]);
    const cancelSubscription = vi.fn().mockResolvedValue(stale);

    const result = await reconcileBillingFromStripe("user_1", {
      db: profileSelect({
        plan: "free",
        stripeCustomerId: "cus_1",
      }) as never,
      listSubscriptions,
      cancelSubscription,
    });

    expect(cancelSubscription).toHaveBeenCalledWith("sub_stale");
    expect(result.canceledStaleIncomplete).toBe(1);
    expect(result.plan).toBe("free");
    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({ status: "canceled" }),
      expect.anything(),
    );
  });

  it("preserves fresh incomplete subscription", async () => {
    const fresh = sub({ id: "sub_fresh", status: "incomplete" });
    const listSubscriptions = vi.fn().mockResolvedValue([fresh]);
    const cancelSubscription = vi.fn();

    const result = await reconcileBillingFromStripe("user_1", {
      db: profileSelect({
        plan: "free",
        stripeCustomerId: "cus_1",
      }) as never,
      listSubscriptions,
      cancelSubscription,
    });

    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({ status: "incomplete" }),
      expect.anything(),
    );
    expect(result.plan).toBe("free");
    expect(result.updated).toBe(true);
  });

  it("returns current plan when Stripe list fails", async () => {
    const listSubscriptions = vi
      .fn()
      .mockRejectedValue(new Error("stripe down"));

    const result = await reconcileBillingFromStripe("user_1", {
      db: profileSelect({
        plan: "pro",
        stripeCustomerId: "cus_1",
      }) as never,
      listSubscriptions,
    });

    expect(result.updated).toBe(false);
    expect(result.plan).toBe("pro");
    expect(mockApply).not.toHaveBeenCalled();
  });
});
