# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run lint      # Run ESLint
```

No test suite is configured. Build verification: `npm run build`.

## Environment Variables

Required in `.env.local` (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — Admin operations (server-side only)
- `ANTHROPIC_API_KEY` — Claude API for `/api/ai/chat`
- `NEXT_PUBLIC_APP_URL` — App base URL

## Architecture

**Next.js 16 App Router** with two route groups:
- `app/(auth)/` — Public pages: login, signup, forgot-password, auth/callback
- `app/(app)/` — Protected pages: dashboard, accounts, transactions, credit-cards, debts, savings, subscriptions, expenses, invoices, categories, profile

**Auth:** Supabase Auth (email/password + Google OAuth). Middleware in `lib/supabase/middleware.ts` enforces route protection. Server-side clients use `@supabase/ssr` cookie handling. Row Level Security (`auth.uid() = user_id`) is enforced at the DB level on every table — no client-side auth checks needed.

**Page pattern:** Every protected page is a Server Component that fetches data and passes it to a `*-client.tsx` Client Component for interactivity. Server components use `lib/supabase/server.ts`; client components use `lib/supabase/client.ts`.

**AI integration:** `app/api/ai/chat/route.ts` implements an agentic loop — sends user messages + MCP tools to Claude (`claude-sonnet-4-20250514`), executes any tool calls via `lib/mcp/handlers.ts`, and streams SSE responses back. The system prompt is built dynamically per user from `lib/ai/system-prompt.ts` using preferences in the `prompt_settings` table.

**MCP tools** (`lib/mcp/tools.ts` + `lib/mcp/handlers.ts`): 20+ tools for reading/writing financial data (accounts, transactions, credit cards, debts, savings, subscriptions, invoices, categories, merchants, financial health). Each handler queries Supabase with `user_id` filter. `app/api/mcp/route.ts` exposes these as a JSON-RPC 2.0 endpoint.

**Supabase schema** (`supabase/migrations/`): 25+ tables — `profiles`, `accounts`, `transactions`, `categories`, `credit_cards`, `credit_card_statements`, `debts`, `savings_plans`, `subscriptions`, `invoices`, `financial_health_snapshots`, `monthly_allocations`, etc. A `handle_new_user()` trigger auto-creates `profiles` and `prompt_settings` rows on signup.

**Import alias:** `@/` resolves to the project root.

**UI stack:** Radix UI primitives in `components/ui/`, styled with Tailwind CSS v4. Shared layout in `components/layout/` (Sidebar, Topbar). Floating AI chat widget in `components/chat/ai-chat-button.tsx`.

**Utilities** (`lib/utils.ts`): `cn()` for class merging, currency/date/percent formatters, `TX_TYPE_LABELS`/`TX_TYPE_COLORS` maps, debt amortization helpers.

**Generated types** (`types/database.ts`): Supabase-generated TypeScript types for all tables — use these for DB query typing.
