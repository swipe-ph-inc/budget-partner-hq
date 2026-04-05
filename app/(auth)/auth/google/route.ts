import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { absolutizeAppOrigin } from "@/lib/app-origin";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

/**
 * Initiates Google OAuth from a plain GET navigation (<a href="/auth/google">).
 *
 * Why a dedicated route instead of client-side signInWithOAuth?
 *   - Safari/iOS blocks window.location.href inside async callbacks (user-gesture timeout)
 *   - A plain <a> tag → server GET avoids all JavaScript timing issues
 *
 * Why explicitly set cookies on the redirect response?
 *   - Next.js Route Handlers do NOT automatically merge cookies().set() calls
 *     onto a NextResponse.redirect() response.
 *   - If we omit this, the PKCE code_verifier cookie is never sent to the browser,
 *     so exchangeCodeForSession() fails silently on the callback.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));

  const appOrigin = absolutizeAppOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    new URL(request.url).origin
  );
  const redirectTo = `${appOrigin}/auth/callback?next=${encodeURIComponent(next)}`;

  const cookieStore = await cookies();

  // Capture cookies Supabase wants to set (PKCE code_verifier + state)
  // instead of writing them to cookieStore — we'll attach them to the response manually.
  type PendingCookie = { name: string; value: string; options: Record<string, unknown> };
  const pending: PendingCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach((c) => pending.push(c)),
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Google otherwise reuses the browser’s active Google session and skips the picker.
      // https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${appOrigin}/login?error=auth_callback_failed`);
  }

  const response = NextResponse.redirect(data.url);

  // Attach PKCE verifier and state cookies directly to the redirect response.
  // This is the critical step — without it Safari (and any browser) never receives
  // the code_verifier and the callback exchange will always fail.
  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, {
      ...(options as Parameters<typeof response.cookies.set>[2]),
      // Ensure lax so the cookie is sent back on the Google → app redirect.
      sameSite: "lax",
      httpOnly: true,
      secure: true,
      path: "/",
    });
  }

  return response;
}
