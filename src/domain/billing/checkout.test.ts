import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingError } from "@/domain/billing/errors";

const mockPortal = vi.fn();
const mockEnsureCustomer = vi.fn();
const mockStripeList = vi.fn();
const mockCheckoutCreate = vi.fn();

vi.mock("@/domain/billing/portal", () => ({
  createBillingPortalSession: (...args: unknown[]) => mockPortal(...args),
}));

vi.mock("@/domain/billing/ensure-customer", () => ({
  ensureStripeCustomer: (...args: unknown[]) => mockEnsureCustomer(...args),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    subscriptions: { list: mockStripeList },
    checkout: { sessions: { create: mockCheckoutCreate } },
  }),
}));

vi.mock("@/lib/stripe/config", () => ({
  getSiteUrl: () => "https://example.com",
  getStripeProMonthlyPriceId: () => "price_pro_test",
}));

vi.mock("@/domain/billing/reconcile-billing", () => ({
  pickPreferredSubscription: (subs: { status: string }[]) => {
    const open = subs.filter((s) =>
      ["active", "trialing", "incomplete", "past_due"].includes(s.status),
    );
    return open[0] ?? null;
  },
  reconcileBillingFromStripe: vi.fn().mockResolvedValue({
    userId: "user_1",
    plan: "free",
    updated: false,
    canceledStaleIncomplete: 0,
  }),
}));

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

describe("createCheckoutSessionForPro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureCustomer.mockResolvedValue("cus_1");
    mockPortal.mockResolvedValue({ url: "https://portal.stripe.test" });
    mockCheckoutCreate.mockResolvedValue({ url: "https://checkout.stripe.test" });
    mockStripeList.mockResolvedValue({ data: [] });
  });

  it("throws already_pro when user is on pro", async () => {
    const { createCheckoutSessionForPro } = await import(
      "@/domain/billing/checkout"
    );
    const db = profileSelect({
      plan: "pro",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
    });

    await expect(
      createCheckoutSessionForPro("user_1", { db: db as never }),
    ).rejects.toMatchObject({ code: "already_pro" });
  });

  it("redirects to portal when profile has incomplete status", async () => {
    const { createCheckoutSessionForPro } = await import(
      "@/domain/billing/checkout"
    );
    const db = profileSelect({
      plan: "free",
      stripeSubscriptionId: "sub_inc",
      stripeSubscriptionStatus: "incomplete",
    });

    const result = await createCheckoutSessionForPro("user_1", {
      db: db as never,
    });

    expect(result.url).toBe("https://portal.stripe.test");
    expect(mockPortal).toHaveBeenCalled();
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("throws subscription_in_progress for active subscription in profile", async () => {
    const { createCheckoutSessionForPro } = await import(
      "@/domain/billing/checkout"
    );
    const db = profileSelect({
      plan: "free",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
    });

    await expect(
      createCheckoutSessionForPro("user_1", { db: db as never }),
    ).rejects.toMatchObject({
      code: "subscription_in_progress",
    } satisfies Partial<BillingError>);
  });

  it("creates checkout when no open subscriptions", async () => {
    const { createCheckoutSessionForPro } = await import(
      "@/domain/billing/checkout"
    );
    const db = profileSelect({
      plan: "free",
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    });

    const result = await createCheckoutSessionForPro("user_1", {
      db: db as never,
    });

    expect(result.url).toBe("https://checkout.stripe.test");
    expect(mockCheckoutCreate).toHaveBeenCalled();
  });

  it("redirects to portal when Stripe has past_due subscription only", async () => {
    const { createCheckoutSessionForPro } = await import(
      "@/domain/billing/checkout"
    );
    const db = profileSelect({
      plan: "free",
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    });
    mockStripeList.mockResolvedValue({
      data: [{ id: "sub_past", status: "past_due", items: { data: [] } }],
    });

    const result = await createCheckoutSessionForPro("user_1", {
      db: db as never,
    });

    expect(result.url).toBe("https://portal.stripe.test");
    expect(mockPortal).toHaveBeenCalled();
  });

  it("redirects to portal when Stripe has incomplete subscription only", async () => {
    const { createCheckoutSessionForPro } = await import(
      "@/domain/billing/checkout"
    );
    const db = profileSelect({
      plan: "free",
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    });
    mockStripeList.mockResolvedValue({
      data: [{ id: "sub_inc", status: "incomplete", items: { data: [] } }],
    });

    const result = await createCheckoutSessionForPro("user_1", {
      db: db as never,
    });

    expect(result.url).toBe("https://portal.stripe.test");
    expect(mockPortal).toHaveBeenCalled();
  });

  it("throws subscription_in_progress for trialing subscription in profile", async () => {
    const { createCheckoutSessionForPro } = await import(
      "@/domain/billing/checkout"
    );
    const db = profileSelect({
      plan: "free",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "trialing",
    });

    await expect(
      createCheckoutSessionForPro("user_1", { db: db as never }),
    ).rejects.toMatchObject({
      code: "subscription_in_progress",
    });
  });
});
