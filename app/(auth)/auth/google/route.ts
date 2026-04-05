import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { absolutizeAppOrigin } from "@/lib/app-origin";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

/**
 * Starts Google OAuth with a full GET navigation (link or address bar).
 * Client-side async + window.location is unreliable on iPad/Safari (WebKit may
 * block programmatic navigation after await). This route keeps the redirect
 * entirely server-driven after the user taps a same-origin link.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));

  // Use NEXT_PUBLIC_APP_URL so the redirectTo is always the real public domain,
  // even when the server is behind a Vercel/reverse-proxy that changes request.url.
  const appOrigin = absolutizeAppOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    new URL(request.url).origin
  );
  const redirectTo = `${appOrigin}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${appOrigin}/login?error=auth_callback_failed`);
  }

  return NextResponse.redirect(data.url);
}
