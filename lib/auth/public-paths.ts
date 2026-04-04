/**
 * Routes that anonymous users may access without signing in.
 * Keep in sync with `proxy.ts` matcher (static assets are already excluded there).
 */
const EXACT_PUBLIC_PATHS = new Set([
  "/terms",
  "/refund-policy",
  /** Next metadata routes — must be reachable without auth for crawlers */
  "/robots.txt",
  "/sitemap.xml",
]);

const PUBLIC_PREFIXES = [
  "/pricing",
  /** PWA manifest + icons under `public/favicon_io/` */
  "/favicon_io/",
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/api/paymongo/webhook",
  "/api/cron/",
  "/api/health",
  "/api/ready",
] as const;

/**
 * Returns true when the pathname does not require an authenticated session.
 */
export function isPublicPath(pathname: string): boolean {
  if (EXACT_PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Auth-only flows: logged-in users are redirected to the app dashboard so they
 * do not see login/signup screens. Marketing pages (/, /terms, /pricing, …) are excluded.
 */
export function shouldRedirectAuthenticatedUserToDashboard(pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/forgot-password")) return true;
  if (pathname.startsWith("/auth/callback")) return true;
  return false;
}
