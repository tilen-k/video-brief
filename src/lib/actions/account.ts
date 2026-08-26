"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { userHasPassword } from "@/domain/account";
import { isGuestUser } from "@/domain/auth/is-anonymous";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  createPasswordSchema,
} from "@/lib/validations/auth";

export type AccountPasswordState = {
  error?: string;
  success?: boolean;
};

function currentPasswordError(error: { code?: string }): string {
  if (error.code === "invalid_credentials") {
    return "Current password is incorrect";
  }
  if (error.code === "email_not_confirmed") {
    return "Confirm your email before changing your password.";
  }
  if (error.code === "over_request_rate_limit") {
    return "Too many attempts. Try again later.";
  }
  return "Could not verify your current password. Try again.";
}

export async function updateAccountPassword(
  _prev: AccountPasswordState,
  formData: FormData,
): Promise<AccountPasswordState> {
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

  if (!(await getOnboardingCompleted(user.id))) {
    redirect("/onboarding");
  }

  const hasPassword = userHasPassword(user);

  if (hasPassword) {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    if (!user.email) {
      return { error: "Your account has no email address." };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    });

    if (signInError) {
      return { error: currentPasswordError(signInError) };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (error) {
      console.error("updateUser password failed", error);
      return { error: "Could not update password. Try again." };
    }
  } else {
    const parsed = createPasswordSchema.safeParse({
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (error) {
      console.error("updateUser password failed", error);
      return { error: "Could not update password. Try again." };
    }
  }

  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/account");
  return { success: true };
}
