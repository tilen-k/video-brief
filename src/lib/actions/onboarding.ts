"use server";

import { redirect } from "next/navigation";

import { saveOnboarding } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";
import { onboardingInputSchema } from "@/lib/validations/onboarding";

export type OnboardingActionState = {
  error?: string;
};

function formToOnboardingInput(formData: FormData) {
  return onboardingInputSchema.safeParse({
    yearOfBirth: formData.get("yearOfBirth") ?? undefined,
    educationLevel: formData.get("educationLevel") ?? undefined,
    subjects: formData.getAll("subjects"),
    summaryStyle: formData.get("summaryStyle") ?? undefined,
  });
}

export async function completeOnboarding(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const intent = formData.get("intent");
  const input =
    intent === "skip"
      ? { success: true as const, data: {} }
      : formToOnboardingInput(formData);

  if (!input.success) {
    return { error: input.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await saveOnboarding(user.id, input.data);
  } catch (error) {
    console.error("saveOnboarding failed", error);
    return {
      error:
        intent === "skip"
          ? "Could not skip onboarding. Try again."
          : "Could not save your preferences. Try again.",
    };
  }

  redirect("/library");
}
