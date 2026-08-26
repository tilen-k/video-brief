import "server-only";

import Stripe from "stripe";

import { getStripeSecretKey } from "@/lib/stripe/config";

const globalForStripe = globalThis as unknown as {
  stripeClient?: Stripe;
};

/**
 * Shared Stripe client (instance API — never set global stripe.apiKey).
 * Uses the SDK's default API version; match webhook endpoint version in Dashboard.
 */
export function getStripeClient(): Stripe {
  if (globalForStripe.stripeClient) {
    return globalForStripe.stripeClient;
  }

  const client = new Stripe(getStripeSecretKey(), {
    typescript: true,
    apiVersion: Stripe.API_VERSION,
  });

  globalForStripe.stripeClient = client;
  return client;
}
