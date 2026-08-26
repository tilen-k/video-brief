import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeInternalPath } from "@/domain/auth/safe-next-path";

/**
 * Creates a guest (anonymous) Supabase session on first visit, then redirects.
 * Cookie writes must target the redirect response (not next/headers alone).
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { searchParams, origin } = new URL(request.url);
  const next = safeInternalPath(searchParams.get("next"), "/");

  if (!url || !anonKey) {
    console.warn(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    return NextResponse.redirect(`${origin}/login?error=guest`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return response;
  }

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("signInAnonymously failed", error);
    return NextResponse.redirect(`${origin}/login?error=guest`);
  }

  return response;
}
