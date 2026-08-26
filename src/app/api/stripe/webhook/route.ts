import { NextResponse } from "next/server";

import { processStripeWebhookRequest } from "@/domain/billing/webhook";

export const runtime = "nodejs";

/**
 * Stripe webhook — raw body required for signature verification.
 * Entitlement updates happen here; Checkout success URL never sets plan.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = Buffer.from(await request.arrayBuffer());

  const result = await processStripeWebhookRequest({
    rawBody,
    signature,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ received: true });
}
