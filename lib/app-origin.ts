/**
 * Normalizes NEXT_PUBLIC_APP_URL for `new URL()`, OpenRouter referer, redirects, etc.
 * - Host-only production hosts (e.g. admin.budgetpartnerhq.com) → https://…
 * - localhost / 127.0.0.1 → http://…
 * - `whenEmpty` is used when the env var is unset (e.g. local dev defaults to http://localhost:3000).
 */
export function absolutizeAppOrigin(
  raw: string | undefined,
  whenEmpty = "https://budgetpartnerhq.com"
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return whenEmpty;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, "");
  if (/^localhost|^127\./i.test(trimmed)) return `http://${trimmed.replace(/\/$/, "")}`;
  return `https://${trimmed.replace(/\/$/, "")}`;
}
