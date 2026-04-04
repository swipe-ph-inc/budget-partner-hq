"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Is my financial data safe?",
    a: "Yes. All your data is stored in an encrypted database (Supabase on AWS) with Row Level Security — meaning your records are strictly isolated from other users at the database level. We never sell your data, and we never share it with third parties without your explicit consent.",
  },
  {
    q: "What does the Pro plan include that Free doesn't?",
    a: "Pro unlocks unlimited accounts and credit cards (Free is capped at 3 each), full transaction history (Free shows only the last 30 days), and all premium features: AI Finance Assistant, Savings Goals, Debt Manager, Invoice Generator, Calendar View, and priority support.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. You can cancel your Pro subscription at any time from your profile. You'll keep Pro access until the end of your current billing period and won't be charged again. No cancellation fees.",
  },
  {
    q: "Does Budget Partner HQ support multiple currencies?",
    a: "Yes. You can set your base display currency in Profile settings, and each account, credit card, transaction, and invoice can be recorded in any supported currency. The app currently supports PHP, USD, EUR, GBP, SGD, AUD, JPY, HKD, and more.",
  },
  {
    q: "How does the AI Finance Assistant work?",
    a: "The AI is powered by a large language model (Claude or GPT-class) and has secure access to your own financial data via built-in tools. It can read your balances, summarise spending, help log transactions, analyse debts, and give personalised guidance — all within the chat. It never accesses other users' data and never stores your conversation beyond what you choose.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Budget Partner HQ is a personal finance organisation and tracking tool. Nothing in the app — including AI-generated suggestions — constitutes financial, investment, legal, or tax advice. Always consult a qualified professional before making significant financial decisions.",
  },
  {
    q: "How does subscription tracking and auto-logging work?",
    a: "When you add a subscription with auto-log enabled, the system automatically records the transaction and advances the billing date on each due date. This keeps your account balances accurate without manual entry. You can also pause or cancel any subscription at any time.",
  },
  {
    q: "Can I import transactions from my bank?",
    a: "Direct bank integration is on the roadmap. Currently, you can add transactions manually or via the AI assistant (just describe what you spent and it logs it for you). We're working on CSV import and open banking connectors for future releases.",
  },
  {
    q: "What is the Debt Manager and how does it help?",
    a: "The Debt Manager tracks all your loans and their balances, interest rates, and monthly payments. It runs an AI-powered strategy evaluation — choosing between Avalanche (highest interest first), Snowball (smallest balance first), and Hybrid methods — and shows you your projected payoff date and total interest saved.",
  },
  {
    q: "Is the annual plan refundable if I change my mind?",
    a: "New subscribers get a 14-day full refund window on their first payment. Renewals are generally non-refundable once the new period starts, but we review billing errors and exceptional cases on a case-by-case basis. See our full Refund Policy for details.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
      {FAQS.map((faq, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left hover:bg-secondary/50 transition-colors"
            aria-expanded={open === i}
          >
            <span className="font-medium text-foreground text-sm sm:text-base leading-snug">
              {faq.q}
            </span>
            <span className="shrink-0 mt-0.5 text-primary">
              {open === i ? (
                <Minus className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </span>
          </button>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              open === i ? "max-h-96" : "max-h-0"
            )}
          >
            <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
              {faq.a}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
