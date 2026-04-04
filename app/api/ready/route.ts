import { NextResponse } from "next/server";

/**
 * Readiness — required public env for Supabase client is present.
 * Extend with DB ping if you need stricter checks behind a load balancer.
 */
export async function GET() {
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!hasSupabase) {
    return NextResponse.json(
      { ok: false, reason: "missing_supabase_public_env" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, ready: true });
}
