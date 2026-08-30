"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isGuestUser } from "@/domain/auth/is-anonymous";
import { saveSummaryPreferences } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";
import { updateSummaryPreferencesSchema } from "@/lib/validations/summary-preferences";

export type SummaryPreferencesActionState = {
  error?: string;
  success?: boolean;
};

export async function updateSummaryPreferences(
  _prev: SummaryPreferencesActionState,
  formData: FormData,
): Promise<SummaryPreferencesActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  if (isGuestUser(user)) {
    redirect("/");
  }

  const parsed = updateSummaryPreferencesSchema.safeParse({
    defaultSummaryLanguage: formData.get("defaultSummaryLanguage"),
    summaryTone: formData.get("summaryTone"),
    summaryLength: formData.get("summaryLength"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid preferences",
    };
  }

  try {
    await saveSummaryPreferences(user.id, parsed.data);
  } catch (error) {
    console.error("saveSummaryPreferences failed", error);
    return { error: "Could not save your preferences. Try again." };
  }

  revalidatePath("/");
  revalidatePath("/account");
  return { success: true };
}
