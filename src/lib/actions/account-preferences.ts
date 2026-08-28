"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isGuestUser } from "@/domain/auth/is-anonymous";
import { saveDefaultSummaryLanguage } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";
import { updateDefaultSummaryLanguageSchema } from "@/lib/validations/summary-language";

export type SummaryPreferencesActionState = {
  error?: string;
  success?: boolean;
};

export async function updateDefaultSummaryLanguage(
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

  const parsed = updateDefaultSummaryLanguageSchema.safeParse({
    defaultSummaryLanguage: formData.get("defaultSummaryLanguage"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid language",
    };
  }

  try {
    await saveDefaultSummaryLanguage(
      user.id,
      parsed.data.defaultSummaryLanguage,
    );
  } catch (error) {
    console.error("saveDefaultSummaryLanguage failed", error);
    return { error: "Could not save your preferences. Try again." };
  }

  revalidatePath("/");
  revalidatePath("/account");
  return { success: true };
}
