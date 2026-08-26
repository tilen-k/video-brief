/**
 * Server-only Stripe config. Price → plan mapping lives here (not in the client).
 * Do not import this from Client Components.
 */
export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return secret;
}

export function getStripeProMonthlyPriceId(): string {
  const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  if (!priceId) {
    throw new Error("STRIPE_PRICE_PRO_MONTHLY is not set");
  }
  return priceId;
}

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SITE_URL is not set");
    }
    return "http://localhost:3000";
  }
  return url;
}

/** Known Stripe Price ids → app plan. Unknown prices never grant Pro. */
export function planForStripePriceId(priceId: string): "pro" | null {
  try {
    if (priceId === getStripeProMonthlyPriceId()) {
      return "pro";
    }
  } catch {
    return null;
  }
  return null;
}
