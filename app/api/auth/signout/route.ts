import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { absolutizeAppOrigin } from "@/lib/app-origin";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const appOrigin = absolutizeAppOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    new URL(request.url).origin
  );

  const pending: { name: string; value: string; options: Record<string, unknown> }[] = [];

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

  await supabase.auth.signOut();

  const response = NextResponse.redirect(`${appOrigin}/login`, { status: 303 });

  // Clear all session cookies on the redirect response
  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, {
      ...(options as Parameters<typeof response.cookies.set>[2]),
      sameSite: "lax",
      httpOnly: true,
      secure: true,
      path: "/",
    });
  }

  // Also explicitly delete known Supabase session cookie names
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("supabase")
    ) {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: true,
      });
    }
  }

  return response;
}
