import { createBrowserClient } from "@supabase/ssr";

// Using untyped client to avoid complex generic inference issues with custom Database types.
// All database operations are still type-safe via TypeScript at the call-site through explicit typing.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Explicit SameSite=lax so the pkce_code_verifier cookie survives the
      // Google → app OAuth redirect on Safari / iOS (WebKit ITP).
      cookieOptions: {
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    }
  );
}
