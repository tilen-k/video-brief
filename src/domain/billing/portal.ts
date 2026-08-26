import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { profiles } from "@/db/schema";
import { BillingError } from "@/domain/billing/errors";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/stripe/config";
import { errorFields, logger } from "@/lib/logger";

export type PortalSessionResult = {
  url: string;
};

export async function createBillingPortalSession(
  userId: string,
  deps: { db?: Db } = {},
): Promise<PortalSessionResult> {
  const db = deps.db ?? createDb();
  const [row] = await db
    .select({ stripeCustomerId: profiles.stripeCustomerId })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!row) {
    throw new BillingError("not_found", "Profile not found.");
  }

  if (!row.stripeCustomerId) {
    throw new BillingError(
      "no_customer",
      "No billing account yet. Upgrade to Pro first.",
    );
  }

  const stripe = getStripeClient();
  const siteUrl = getSiteUrl();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${siteUrl}/account/usage`,
    });

    return { url: session.url };
  } catch (error) {
    logger.error(
      { userId, ...errorFields(error) },
      "billing.portal_session_err",
    );
    throw new BillingError(
      "billing_unavailable",
      "Couldn't open billing portal. Try again in a moment.",
    );
  }
}
