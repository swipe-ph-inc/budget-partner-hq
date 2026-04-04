import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Bot,
  Bell,
  FileText,
  PiggyBank,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Globe,
  Lock,
} from "lucide-react";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { PRO_MONTHLY_PRICE_USD, proAnnualPriceUsd, PRO_ANNUAL_DISCOUNT_PERCENT, formatPlanMoneyUsd } from "@/lib/plans";

// ─── SEO Metadata ────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Budget Partner HQ — Your Personal Finance Command Centre",
  description:
    "Track accounts, credit cards, debts, savings goals, and subscriptions in one place. AI-powered financial guidance for individuals and freelancers. Free to start.",
  keywords: [
    "personal finance app",
    "budget tracker",
    "expense tracker",
    "debt manager",
    "savings goals",
    "subscription tracker",
    "AI finance assistant",
    "freelance budget",
    "credit card manager",
    "budget app Philippines",
  ],
  authors: [{ name: "Budget Partner HQ" }],
  openGraph: {
    type: "website",
    title: "Budget Partner HQ — Your Personal Finance Command Centre",
    description:
      "Track accounts, credit cards, debts, savings, and subscriptions. AI-powered budgeting for individuals and freelancers. Free to start.",
    siteName: "Budget Partner HQ",
    images: [
      {
        url: "/bp_logo.png",
        width: 512,
        height: 512,
        alt: "Budget Partner HQ logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Budget Partner HQ — Personal Finance Command Centre",
    description:
      "Track, plan, and grow your finances with AI-powered guidance. Free to start.",
    images: ["/bp_logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

// ─── Structured Data ─────────────────────────────────────────────────────────

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Budget Partner HQ",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Personal finance command centre for tracking accounts, credit cards, debts, savings goals, and subscriptions with AI-powered guidance.",
  offers: [
    {
      "@type": "Offer",
      name: "Free Plan",
      price: "0",
      priceCurrency: "USD",
      description: "3 accounts, 3 credit cards, 30-day history",
    },
    {
      "@type": "Offer",
      name: "Pro Plan",
      price: String(PRO_MONTHLY_PRICE_USD),
      priceCurrency: "USD",
      description: "Unlimited accounts, full history, AI assistant, and all premium features",
    },
  ],
  featureList: [
    "Account & balance tracking",
    "Credit card management",
    "Debt strategy engine",
    "Savings goal tracking",
    "Subscription auto-logging",
    "Invoice generator",
    "AI finance assistant",
    "Monthly budget allocations",
    "Spending notifications",
  ],
};

// ─── Feature list ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Wallet,
    title: "Smart Account Tracking",
    desc: "Savings, checking, e-wallets, and cash — all balances auto-updated from every transaction you log.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: CreditCard,
    title: "Credit Card Manager",
    desc: "Track balances, statements, payment due dates, and instalment plans across all your cards.",
    color: "bg-warning/10 text-warning-700",
  },
  {
    icon: TrendingUp,
    title: "Debt Strategy Engine",
    desc: "AI evaluates Avalanche, Snowball, and Hybrid payoff methods and tells you exactly how to get debt-free faster.",
    color: "bg-destructive/10 text-destructive",
  },
  {
    icon: PiggyBank,
    title: "Savings Goals",
    desc: "Create goals with targets and deadlines. Every contribution is tracked and your progress updates in real time.",
    color: "bg-success/10 text-success-600",
  },
  {
    icon: RefreshCw,
    title: "Subscription Watcher",
    desc: "Log subscriptions once and let the system auto-record every recurring charge on the right billing date.",
    color: "bg-accent text-primary",
  },
  {
    icon: FileText,
    title: "Invoice Generator",
    desc: "Create professional invoices for freelance work, track payment status, and record income automatically.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: BarChart3,
    title: "Monthly Allocations",
    desc: "Payday budget planner that splits income into obligations, savings goals, and safe-to-spend — in seconds.",
    color: "bg-success/10 text-success-600",
  },
  {
    icon: Bot,
    title: "AI Finance Assistant",
    desc: "Chat with your finances. Ask for summaries, log transactions by description, or get a personalised action plan.",
    color: "bg-warning/10 text-warning-700",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    desc: "Proactive alerts for overdue payments, high credit utilisation, savings milestones, and budget drift.",
    color: "bg-destructive/10 text-destructive",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Add your accounts & cards",
    desc: "Connect your banks, e-wallets, credit cards, and cash accounts. Set your base currency and you're ready.",
  },
  {
    n: "02",
    title: "Log income, expenses & transfers",
    desc: "Record transactions manually, describe them to the AI, or let auto-logging handle recurring subscriptions.",
  },
  {
    n: "03",
    title: "Get a clear financial picture",
    desc: "Watch balances update in real time, receive alerts before things go wrong, and let the AI guide your next move.",
  },
];

const FREE_FEATURES = [
  "3 bank / e-wallet accounts",
  "3 credit cards",
  "30 days transaction history",
  "Expense & subscription tracking",
  "Category & merchant management",
  "Spending notifications",
];

const PRO_FEATURES = [
  "Unlimited accounts & credit cards",
  "Full transaction history",
  "AI Finance Assistant (chat)",
  "Debt Manager + Strategy Engine",
  "Savings Goals & Contributions",
  "Invoice Generator",
  "Calendar View",
  "Monthly Budget Allocations",
  "Priority support",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const annualTotal = proAnnualPriceUsd();
  const annualMonthly = annualTotal / 12;

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-background flex flex-col">
        {/* ── Nav ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/bp_logo.png" alt="Budget Partner HQ" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="font-display font-semibold text-foreground text-sm sm:text-base leading-tight">
                Budget Partner HQ
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-800 transition-colors"
              >
                Get started free
              </Link>
            </div>
          </div>
        </header>

        <main>
          {/* ── Hero ──────────────────────────────────────────────────── */}
          <section className="relative overflow-hidden">
            {/* Background gradient blobs */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-primary/8 blur-3xl" />
              <div className="absolute -bottom-32 -right-32 h-[480px] w-[480px] rounded-full bg-accent blur-3xl opacity-60" />
            </div>

            <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered Personal Finance
              </div>

              <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl leading-tight max-w-4xl mx-auto">
                Your personal finance{" "}
                <span className="text-primary">command centre</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Track every account, credit card, debt, subscription, and savings goal — all in one
                place. Then let the AI turn your numbers into a clear action plan.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary-800 transition-colors shadow-float"
                >
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#pricing"
                  className="rounded-xl border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  See pricing
                </a>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                No credit card required · Free plan available · Cancel anytime
              </p>

              {/* Trust badges */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
                {[
                  { icon: ShieldCheck, text: "End-to-end encrypted" },
                  { icon: Lock, text: "Row-level security" },
                  { icon: Globe, text: "Multi-currency" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-success" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Features ──────────────────────────────────────────────── */}
          <section id="features" className="border-t border-border bg-card/40 py-20 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="text-center mb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
                  Everything you need
                </p>
                <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
                  One app. Complete financial clarity.
                </h2>
                <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                  From daily expenses to long-term wealth planning — Budget Partner HQ covers every
                  part of your financial life.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-2xl border border-border bg-card p-6 hover:shadow-card-hover transition-all group"
                  >
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.color} mb-4`}>
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── How it works ──────────────────────────────────────────── */}
          <section className="py-20 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="text-center mb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
                  Getting started
                </p>
                <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
                  Up and running in minutes
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                {/* connector line — desktop only */}
                <div aria-hidden className="hidden md:block absolute top-12 left-[calc(16.666%+2rem)] right-[calc(16.666%+2rem)] h-px bg-border" />

                {STEPS.map((step) => (
                  <div key={step.n} className="text-center relative">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5 font-display font-bold text-primary text-xl mb-5 relative z-10 bg-background">
                      {step.n}
                    </div>
                    <h3 className="font-semibold text-foreground text-lg mb-3">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-12 text-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground hover:bg-primary-800 transition-colors"
                >
                  Create your free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── AI Callout ────────────────────────────────────────────── */}
          <section className="border-t border-b border-border bg-primary py-16 sm:py-20">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/10 mb-6">
                <Bot className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="font-display text-3xl font-bold text-primary-foreground sm:text-4xl mb-4">
                Your AI finance partner — always on call
              </h2>
              <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
                Ask questions in plain language. &ldquo;How much did I spend on food last month?&rdquo; &ldquo;What&apos;s my
                safe-to-spend this week?&rdquo; &ldquo;Log ₱450 at Jollibee.&rdquo; The AI reads your live data and
                gives you real answers — not generic advice.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/5 px-6 py-4 text-left max-w-xs w-full">
                  <p className="text-xs text-primary-foreground/60 mb-1">You</p>
                  <p className="text-sm text-primary-foreground">&ldquo;Am I on track to pay off my credit card by December?&rdquo;</p>
                </div>
                <div className="rounded-2xl border border-success/30 bg-success/10 px-6 py-4 text-left max-w-xs w-full">
                  <p className="text-xs text-success mb-1">Budget Partner AI</p>
                  <p className="text-sm text-primary-foreground/90">&ldquo;Based on your ₱3,200 balance and ₱800/month payments, you&apos;ll be clear by October — 2 months early!&rdquo;</p>
                </div>
              </div>
              <p className="mt-6 text-xs text-primary-foreground/50">
                AI features are available on the Pro plan.
              </p>
            </div>
          </section>

          {/* ── Pricing ───────────────────────────────────────────────── */}
          <section id="pricing" className="py-20 sm:py-24">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="text-center mb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
                  Simple pricing
                </p>
                <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
                  Start free. Upgrade when you&apos;re ready.
                </h2>
                <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
                  No hidden fees, no feature-gating tricks. The free plan is genuinely useful.
                  Pro unlocks everything.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Free */}
                <div className="rounded-2xl border border-border bg-card p-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Free</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-display text-4xl font-bold text-foreground">$0</span>
                    <span className="text-muted-foreground text-sm">/ month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-8">No credit card required.</p>
                  <Link
                    href="/signup"
                    className="block w-full rounded-xl border border-border bg-secondary py-3 text-center text-sm font-semibold text-foreground hover:bg-muted transition-colors mb-8"
                  >
                    Get started free
                  </Link>
                  <ul className="space-y-3">
                    {FREE_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pro */}
                <div className="rounded-2xl border-2 border-primary bg-primary p-8 relative overflow-hidden">
                  <div aria-hidden className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary-foreground/5" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/70 mb-2">Pro</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-display text-4xl font-bold text-primary-foreground">
                      {formatPlanMoneyUsd(PRO_MONTHLY_PRICE_USD)}
                    </span>
                    <span className="text-primary-foreground/70 text-sm">/ month</span>
                  </div>
                  <p className="text-sm text-primary-foreground/70 mb-1">
                    or{" "}
                    <strong className="text-primary-foreground">
                      {formatPlanMoneyUsd(annualMonthly)}/mo
                    </strong>{" "}
                    billed annually
                    <span className="ml-2 inline-flex items-center rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
                      Save {PRO_ANNUAL_DISCOUNT_PERCENT}%
                    </span>
                  </p>
                  <p className="text-xs text-primary-foreground/50 mb-8">
                    {formatPlanMoneyUsd(annualTotal)} / year total
                  </p>
                  <Link
                    href="/signup"
                    className="block w-full rounded-xl bg-primary-foreground py-3 text-center text-sm font-semibold text-primary hover:bg-primary-50 transition-colors mb-8"
                  >
                    Start Pro — 14-day refund window
                  </Link>
                  <ul className="space-y-3">
                    {PRO_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-primary-foreground/90">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────── */}
          <section id="faq" className="border-t border-border bg-card/40 py-20 sm:py-24">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <div className="text-center mb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
                  FAQ
                </p>
                <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
                  Common questions
                </h2>
              </div>
              <FaqAccordion />
            </div>
          </section>

          {/* ── Final CTA ─────────────────────────────────────────────── */}
          <section className="border-t border-border py-20 sm:py-24">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <Image
                src="/bp_logo.png"
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 object-contain mx-auto mb-6"
              />
              <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl mb-4">
                Take control of your finances today
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Join Budget Partner HQ for free. No credit card, no contracts. Upgrade to Pro only
                when it feels right.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground hover:bg-primary-800 transition-colors shadow-float"
                >
                  Create your free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-border bg-card px-8 py-4 text-base font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  Already have an account
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              {/* Brand */}
              <div className="sm:col-span-2 md:col-span-1">
                <Link href="/" className="flex items-center gap-2.5 mb-3">
                  <Image src="/bp_logo.png" alt="Budget Partner HQ" width={32} height={32} className="h-8 w-8 object-contain" />
                  <span className="font-display font-semibold text-foreground text-sm">Budget Partner HQ</span>
                </Link>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  Your personal finance command centre. Track, plan, and grow your wealth with clarity.
                </p>
              </div>

              {/* Product */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Product</p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                  <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                  <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
                </ul>
              </div>

              {/* Account */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Account</p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li>
                    <Link href="/signup" className="hover:text-foreground transition-colors">Sign up free</Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Legal</p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li>
                    <Link href="/terms" className="hover:text-foreground transition-colors">Terms &amp; Conditions</Link>
                  </li>
                  <li>
                    <Link href="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-border pt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} Budget Partner HQ. All rights reserved.</p>
              <p>
                Not financial advice. See our{" "}
                <Link href="/terms" className="hover:text-foreground underline underline-offset-2">
                  Terms &amp; Conditions
                </Link>.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
