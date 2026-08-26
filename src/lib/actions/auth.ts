"use server";

import { redirect } from "next/navigation";

import { syncProfileAfterConvert } from "@/domain/auth/convert-profile";
import { guestDisplayName } from "@/domain/auth/guest-display-name";
import { isAnonymousUser } from "@/domain/auth/is-anonymous";
import { needsOnboarding } from "@/domain/auth/needs-onboarding";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/validations/auth";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();

  // Guest → permanent: updateUser keeps the same auth.users.id.
  if (existing && isAnonymousUser(existing)) {
    const { error } = await supabase.auth.updateUser(
      {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      {
        emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      },
    );

    if (error) {
      const code = error.code ?? "";
      if (
        code === "email_exists" ||
        code === "user_already_exists" ||
        /already|registered|exists/i.test(error.message)
      ) {
        return {
          error:
            "That email is already registered. Log in instead — this browser’s guest library won’t move over.",
        };
      }
      return { error: error.message };
    }

    const localPart = parsed.data.email.split("@")[0]?.trim();
    await syncProfileAfterConvert(existing.id, {
      email: parsed.data.email,
      displayName:
        localPart && localPart.length > 0
          ? localPart
          : guestDisplayName(existing.id),
    });

    redirect("/onboarding");
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/onboarding");
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !(await needsOnboarding(user))) {
    redirect("/");
  }

  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Prefer POST /auth/signout from the UI (full-document redirect).
  // Soft redirect("/") races guest remint and can SecurityError in Firefox.
  redirect("/auth/guest?next=/");
}

/** Log in / switch account with Google (replaces guest session if present). */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}

/**
 * Convert guest → permanent via Google (same user id), or OAuth signup when
 * there is no anonymous session.
 */
export async function linkGoogleIdentity() {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAnonymousUser(user)) {
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/onboarding`,
      },
    });

    if (error || !data.url) {
      const code = error?.code ?? "";
      if (
        code === "identity_already_exists" ||
        /already|linked|exists/i.test(error?.message ?? "")
      ) {
        redirect("/signup?error=google_linked");
      }
      redirect("/signup?error=google");
    }

    redirect(data.url);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error || !data.url) {
    redirect("/signup?error=google");
  }

  redirect(data.url);
}
