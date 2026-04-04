import type { NextConfig } from "next";

// Allowed external origins for CSP connect-src (Supabase realtime + REST, AI providers, PayMongo)
const cspConnectSrc = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://api.anthropic.com",
  "https://openrouter.ai",
  "https://api.paymongo.com",
  // Upstash Redis (rate limiting) — accessed server-side only but keep for consistency
  "https://*.upstash.io",
].join(" ");

// React dev mode uses eval() for debugging (e.g. call stacks); production does not.
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline' for inline scripts; dev also needs 'unsafe-eval' (see above).
  `script-src ${scriptSrc}`,
  // Inline styles are used by Tailwind; Google Fonts stylesheet
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Google Fonts woff/woff2 files
  "font-src 'self' https://fonts.gstatic.com",
  // data: for base64 images; blob: for canvas/file exports; https: for OG images
  "img-src 'self' data: blob: https:",
  `connect-src ${cspConnectSrc}`,
  // PayMongo hosted checkout is loaded in a redirect (not iframe)
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Suppress the "X-Powered-By: Next.js" response header to avoid tech stack disclosure
  poweredByHeader: false,

  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
