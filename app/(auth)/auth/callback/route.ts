import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { absolutizeAppOrigin } from "@/lib/app-origin";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

/**
 * Exchanges the OAuth authorization code for a session.
 *
 * Same cookie-on-redirect issue as /auth/google: Next.js does not automatically
 * merge cookies().set() calls onto NextResponse.redirect().  We capture pending
 * cookies and set them explicitly on the response so the browser actually
 * receives the session tokens (access_token, refresh_token).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const appOrigin = absolutizeAppOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    new URL(request.url).origin
  );

  if (!code) {
    return NextResponse.redirect(`${appOrigin}/login?error=auth_callback_failed`);
  }

  const cookieStore = await cookies();

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${appOrigin}/login?error=auth_callback_failed`);
  }

  const response = NextResponse.redirect(`${appOrigin}${next}`);

  // Attach session cookies (access_token, refresh_token, etc.) directly to the
  // redirect response — otherwise the browser never stores the session and the
  // middleware immediately redirects back to /login.
  for (const { name, value, options } of pending) {
    // Do NOT force httpOnly — session tokens must be JS-readable so that
    // createBrowserClient can find the session on iPad / Safari.
    // The PKCE code_verifier was already sent in /auth/google and consumed
    // here; only the access+refresh token cookies remain in `pending`.
    response.cookies.set(name, value, {
      ...(options as Parameters<typeof response.cookies.set>[2]),
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }

  return response;
}
