# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run lint      # Run ESLint
npm run test      # Vitest (unit tests)
npm run lint:ci   # ESLint on CI-scoped paths (see package.json); full `npm run lint` still reports legacy issues elsewhere
```

CI: GitHub Actions (`.github/workflows/ci.yml`) runs `lint:ci`, test, and build on push/PR. Build verification: `npm run build`.

## Environment Variables

Required in `.env.local` (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — Admin operations (server-side only)
- `AI_PROVIDER` — `openrouter` (default) or `anthropic` for `/api/ai/chat`
- `OPEN_ROUTER_API_KEY` — OpenRouter (required when `AI_PROVIDER=openrouter`)
- `OPEN_ROUTER_MODEL` — Optional; defaults to `openai/gpt-4o-mini`
- `ANTHROPIC_API_KEY` — Direct Anthropic API (when `AI_PROVIDER=anthropic`)
- `NEXT_PUBLIC_APP_URL` — App base URL (also used for `metadataBase`, sitemap, robots)
- `CRON_SECRET` — Protects `/api/cron/*` routes from unauthorized calls
- `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` — Hosted checkout and webhook (see `app/api/paymongo/*`)
- Optional **Upstash** for AI rate limits: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — when unset, `/api/ai/chat` is not Redis-throttled (fine for local dev; set in production)

## Architecture

**Next.js 16 App Router** with two route groups:
- `app/(auth)/` — Auth flows: login, signup, forgot-password, auth/callback
- `app/(app)/` — Signed-in app: dashboard, accounts, transactions, credit-cards, debts, savings, subscriptions, expenses, invoices, categories, profile, calendar, pricing

**Public marketing & legal** (no login): `/` (landing), `/pricing`, `/terms`, `/refund-policy`, `/robots.txt`, `/sitemap.xml`, `/favicon_io/*` — allowlist in `lib/auth/public-paths.ts`, applied from `proxy.ts` via `lib/supabase/middleware.ts` (`updateSession`).

**Auth:** Supabase Auth (email/password + Google OAuth). Next.js 16 uses **`proxy.ts`** (not `middleware.ts`) calling `updateSession` for cookies and redirects. Server-side clients use `@supabase/ssr` cookie handling. Row Level Security (`auth.uid() = user_id`) is enforced at the DB level on every table — no client-side auth checks needed for data access.

**Page pattern:** Every protected page is a Server Component that fetches data and passes it to a `*-client.tsx` Client Component for interactivity. Server components use `lib/supabase/server.ts`; client components use `lib/supabase/client.ts`. All `(app)/` routes export `dynamic = "force-dynamic"` (set once on the layout).

**Plan / subscription gating:**
- `profiles` table has `plan` ("free" | "pro"), `plan_expires_at`, and `plan_interval` ("monthly" | "annual") columns.
- `lib/subscription-access.ts` exports `isProSubscriber(profile)`, `FREE_TIER_ACCOUNT_LIMIT` (3), `FREE_TIER_CREDIT_CARD_LIMIT` (3), `FREE_TIER_HISTORY_DAYS` (30), and `freeTierHistoryStartDate()`.
- `lib/plans.ts` exports pricing constants (`PRO_MONTHLY_PRICE_USD = 9.99`, 17% annual discount) and formatters.
- `app/(app)/layout.tsx` fetches `isPro` once and passes it to `<AppShell isPro={isPro}>`, which forwards it to `<Sidebar>`. The Sidebar shows a lock icon on Pro-only routes (`/calendar`, `/savings`, `/debts`, `/invoices`) for free users.
- Pro-only pages check `isProSubscriber` server-side and render `<UpgradePrompt>` for free users instead of the page content.
- **Billing:** `createPaymongoCheckout` in `app/(app)/pricing/actions.ts` starts PayMongo hosted checkout; `app/api/paymongo/webhook/route.ts` activates Pro on `checkout_session.payment.paid`. `downgradeTofree` sets the user back to Free. No direct “select plan” write without payment for upgrades.
- DB-level enforcement via `is_pro_subscriber(uuid)` SQL function + RLS policies on `accounts` and `credit_cards` insert (free users capped at 3 active each).

**AI integration:** `app/api/ai/chat/route.ts` runs an agentic loop with MCP tools. Deployment defaults: `AI_PROVIDER` (OpenRouter vs Anthropic) and `OPEN_ROUTER_MODEL` / `ANTHROPIC_MODEL`. **Per-user overrides** live on `prompt_settings.ai_provider` and `prompt_settings.ai_model` (null = use deployment defaults); users edit these under **Profile → AI Settings**. Resolution: `lib/ai/resolve-user-llm.ts`. Tool execution: `lib/mcp/handlers.ts`. System prompt: `lib/ai/system-prompt.ts` and optional `system_prompts` DB row.

**MCP tools** (`lib/mcp/tools.ts` + `lib/mcp/handlers.ts`): 20+ tools for reading/writing financial data (accounts, transactions, credit cards, debts, savings, subscriptions, invoices, categories, merchants, financial health). Each handler queries Supabase with `user_id` filter. `app/api/mcp/route.ts` exposes these as a JSON-RPC 2.0 endpoint.

**Notification system:**
- `lib/notifications/generate.ts` — checks 7 conditions (subscriptions due, credit card due/overdue, budget overspent, savings milestones, low freelance buffer, high credit utilisation, instalment plan due/complete) and upserts notifications with deduplication keys.
- `app/api/notifications/route.ts` — GET (last 30 + unread count) / PATCH (mark read by IDs or all).
- `app/api/notifications/generate/route.ts` — POST, generates for current session user.
- `app/api/cron/process-subscriptions/route.ts` — Daily cron (01:00 UTC via `vercel.json`), protected by `CRON_SECRET`, auto-logs subscription transactions and generates notifications.
- `components/layout/notification-bell.tsx` — Bell icon in Topbar; uses `sessionStorage` to call generate at most once per day per browser session.

**Subscription auto-logging:** `lib/subscriptions/process-due.ts` finds active subscriptions with `auto_log_transaction=true` and `next_billing_date <= today`, creates transactions (up to 24 missed cycles), and advances billing dates. Also exposed as a user-facing endpoint at `app/api/subscriptions/process-due/route.ts`.

**Supabase schema** (`supabase/migrations/`): 25+ tables — `profiles`, `accounts`, `transactions`, `categories`, `credit_cards`, `credit_card_statements`, `instalment_plans`, `debts`, `savings_plans`, `subscriptions`, `invoices`, `financial_health_snapshots`, `monthly_allocations`, `notifications`, etc. A `handle_new_user()` trigger auto-creates `profiles` and `prompt_settings` rows on signup. Push migrations with `npx supabase db push`.

**Import alias:** `@/` resolves to the project root.

**UI stack:** Radix UI primitives in `components/ui/`, styled with Tailwind CSS v4. Shared layout in `components/layout/` (Sidebar, Topbar, AppShell). Floating AI chat widget in `components/chat/ai-chat-button.tsx`. `components/subscription/upgrade-prompt.tsx` — reusable gate component for Pro-only pages.

**Utilities:**
- `lib/utils.ts` — `cn()`, currency/date/percent formatters, `TX_TYPE_LABELS`/`TX_TYPE_COLORS` maps, debt amortization helpers.
- `lib/money-input.ts` — `sanitizeMoneyInput`, `formatMoneyInputDisplay`, `parseMoneyInput` for comma-formatted amount fields.

**Generated types** (`types/database.ts`): Supabase-generated TypeScript types for all tables — use these for DB query typing.
