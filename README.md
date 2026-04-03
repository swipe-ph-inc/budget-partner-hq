# Budget Partner HQ

A personal finance management app built for freelancers and individuals who want a clear picture of their money. Track accounts, credit cards, transactions, subscriptions, debts, savings goals, and invoices — with an AI assistant that understands your finances.

## Features

- **Dashboard** — Monthly income/expense summary, savings goal progress, upcoming subscriptions, and financial health snapshot
- **Accounts** — Multiple bank/cash accounts with currency support
- **Credit Cards** — Track outstanding balance, payment due dates, instalments, and pay directly from the app
- **Transactions** — Full transaction history with categories, merchants, and support for expenses, income, transfers, and credit charges
- **Subscriptions** — Auto-log recurring charges to your accounts or credit cards on their billing cycle
- **Debts** — Track loan repayments with amortization schedules
- **Savings Goals** — Set targets and track progress with milestone notifications
- **Invoices** — Log client invoices and track collection status
- **Categories** — Custom categories with budget amounts and color coding
- **Calendar** — Google Calendar-style view of all transactions by Day, Week, Month, or Year *(Pro)*
- **Notifications** — Smart alerts for due payments, budget overruns, savings milestones, and credit utilisation
- **AI Chat** — Agentic assistant with read/write access to all your financial data via MCP tools
- **Plans** — Free and Pro tiers with per-feature access control

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Database & Auth:** Supabase (PostgreSQL + Row Level Security + Auth)
- **AI:** Anthropic Claude via `@anthropic-ai/sdk` with MCP tool calling
- **UI:** Radix UI primitives, Tailwind CSS v4, Recharts, Framer Motion
- **Forms:** React Hook Form + Zod
- **Deployment:** Vercel (with cron jobs)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd budget-partner-hq
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `ANTHROPIC_API_KEY` | Anthropic API key for the AI chat feature |
| `CRON_SECRET` | Random secret for cron route auth — generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |

### 3. Set up Supabase

Create a project at [supabase.com](https://supabase.com), then push the schema:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Migrations are in `supabase/migrations/` and are applied in order. They set up all tables, RLS policies, triggers, and the `is_pro_subscriber()` function.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
```

## Plans

| Feature | Free | Pro |
|---|---|---|
| Accounts | Up to 3 active | Unlimited |
| Credit Cards | Up to 3 active | Unlimited |
| Transaction history | Last 30 days | Full history |
| Calendar | — | ✓ |
| Savings Goals | — | ✓ |
| Debts | — | ✓ |
| Invoices | — | ✓ |
| AI Chat | ✓ | ✓ |
| Notifications | ✓ | ✓ |

Pro is $9.99/month or ~$99.51/year (17% discount). Plan selection is managed via the `/pricing` page.

## Cron Jobs

A daily cron job runs at 01:00 UTC to auto-log due subscription transactions and generate notifications. Configured in `vercel.json`:

```
POST /api/cron/process-subscriptions   (requires Authorization: Bearer <CRON_SECRET>)
```

## Project Structure

```
app/
  (auth)/          # Login, signup, forgot-password
  (app)/           # All authenticated pages
    layout.tsx     # Fetches isPro, wraps AppShell
    dashboard/
    accounts/
    transactions/
    credit-cards/
    subscriptions/
    debts/
    savings/
    expenses/
    invoices/
    categories/
    calendar/      # Pro only
    pricing/
    profile/
  api/
    ai/chat/       # Streaming AI chat with MCP tool loop
    mcp/           # JSON-RPC 2.0 MCP endpoint
    notifications/ # GET + PATCH notifications; POST generate
    cron/          # Daily subscription processing
    subscriptions/ # User-triggered subscription processing
components/
  ui/              # Radix-based primitives
  layout/          # Sidebar, Topbar, AppShell, NotificationBell
  chat/            # Floating AI chat widget
  subscription/    # UpgradePrompt for Pro-gated pages
lib/
  supabase/        # server.ts, client.ts, middleware.ts
  ai/              # System prompt builder
  mcp/             # Tool definitions + handlers
  notifications/   # generate.ts
  subscriptions/   # process-due.ts
  subscription-access.ts   # isProSubscriber, free-tier limits
  plans.ts                 # Pricing constants
  money-input.ts           # Amount field formatting helpers
  utils.ts                 # cn(), formatters, TX_TYPE maps
supabase/
  migrations/      # SQL migration files — push with `npx supabase db push`
types/
  database.ts      # Supabase-generated TypeScript types
```
