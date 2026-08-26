import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Full-document sign-out. Soft Server Action redirects race cookie clears and
 * guest remint (Firefox SecurityError). This route clears the session on the
 * redirect response, then remints a guest in one hop.
 */
async function signOutAndRemintGuest(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const origin = new URL(request.url).origin;

  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/login?error=signout`, 303);
  }

  // 303: POST form must follow as GET to /auth/guest (307 would keep POST → 405).
  const response = NextResponse.redirect(
    `${origin}/auth/guest?next=${encodeURIComponent("/")}`,
    303,
  );

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

  await supabase.auth.signOut();
  return response;
}

export async function POST(request: NextRequest) {
  return signOutAndRemintGuest(request);
}
