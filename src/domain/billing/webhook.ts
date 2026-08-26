import type Stripe from "stripe";

import {
  applySubscriptionToProfile,
  handleSubscriptionDeleted,
  subscriptionSyncFromStripe,
} from "@/domain/billing/sync-subscription";
import { getStripeClient } from "@/lib/stripe/client";
import { getStripeWebhookSecret } from "@/lib/stripe/config";
import { errorFields, logger } from "@/lib/logger";

async function retrieveAndSyncSubscription(
  subscriptionId: string,
): Promise<void> {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await applySubscriptionToProfile(subscriptionSyncFromStripe(subscription));
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription") {
    return;
  }

  const subscriptionRef = session.subscription;
  if (!subscriptionRef) {
    logger.warn(
      { sessionId: session.id },
      "billing.checkout_missing_subscription",
    );
    return;
  }

  const subscriptionId =
    typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
  await retrieveAndSyncSubscription(subscriptionId);
}

async function handleInvoiceEvent(invoice: Stripe.Invoice): Promise<void> {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details") {
    return;
  }

  const subscriptionRef = parent.subscription_details?.subscription;
  if (!subscriptionRef) {
    return;
  }

  const subscriptionId =
    typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
  await retrieveAndSyncSubscription(subscriptionId);
}

/**
 * Process a verified Stripe webhook event.
 * Subscription create/update always re-fetches live state from Stripe.
 */
export async function handleStripeWebhookEvent(
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await retrieveAndSyncSubscription(subscription.id);
      break;
    }
    case "customer.subscription.deleted": {
      await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription,
      );
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      await handleInvoiceEvent(event.data.object as Stripe.Invoice);
      break;
    }
    default:
      break;
  }
}

export function constructStripeWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    getStripeWebhookSecret(),
  );
}

export async function processStripeWebhookRequest(params: {
  rawBody: string | Buffer;
  signature: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!params.signature) {
    return { ok: false, status: 400, error: "Missing Stripe-Signature" };
  }

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(params.rawBody, params.signature);
  } catch (error) {
    logger.warn({ ...errorFields(error) }, "billing.webhook_sig_invalid");
    return { ok: false, status: 400, error: "Invalid signature" };
  }

  try {
    await handleStripeWebhookEvent(event);
    return { ok: true };
  } catch (error) {
    logger.error(
      { eventId: event.id, type: event.type, ...errorFields(error) },
      "billing.webhook_handler_err",
    );
    return { ok: false, status: 500, error: "Webhook handler failed" };
  }
}
