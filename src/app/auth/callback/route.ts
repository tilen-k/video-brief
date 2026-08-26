import { NextResponse } from "next/server";

import { syncProfileAfterConvert } from "@/domain/auth/convert-profile";
import { guestDisplayName } from "@/domain/auth/guest-display-name";
import { safeInternalPath } from "@/domain/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

function displayNameFromUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim().length > 0) {
    return meta.trim();
  }
  const local = user.email?.split("@")[0]?.trim();
  if (local && local.length > 0) {
    return local;
  }
  return guestDisplayName(user.id);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        try {
          await syncProfileAfterConvert(user.id, {
            email: user.email,
            displayName: displayNameFromUser(user),
          });
        } catch (syncError) {
          console.error("syncProfileAfterConvert failed", syncError);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
