"use server";

import { redirect } from "next/navigation";

import {
  BillingError,
  createBillingPortalSession,
  createCheckoutSessionForPro,
} from "@/domain/billing";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";

export type BillingActionState = {
  error?: string;
};

async function requireAccountUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/usage");
  }

  if (!(await getOnboardingCompleted(user.id))) {
    redirect("/onboarding");
  }

  return user;
}

export async function startProCheckout(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void _prev;
  void formData;
  const user = await requireAccountUser();

  let url: string;
  try {
    ({ url } = await createCheckoutSessionForPro(user.id, {
      email: user.email,
    }));
  } catch (error) {
    if (error instanceof BillingError) {
      return { error: error.message };
    }
    return { error: "Couldn't start checkout. Try again." };
  }

  redirect(url);
}

export async function openBillingPortal(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void _prev;
  void formData;
  const user = await requireAccountUser();

  let url: string;
  try {
    ({ url } = await createBillingPortalSession(user.id));
  } catch (error) {
    if (error instanceof BillingError) {
      return { error: error.message };
    }
    return { error: "Couldn't open billing portal. Try again." };
  }

  redirect(url);
}
