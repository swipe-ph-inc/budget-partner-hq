"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRO_ANNUAL_DISCOUNT_PERCENT,
  PRO_MONTHLY_PRICE_USD,
  formatPlanMoneyUsd,
  proAnnualPriceUsd,
} from "@/lib/plans";
import { selectPlan, type SelectablePlanId } from "./actions";

const FULL_YEAR_AT_MONTHLY = PRO_MONTHLY_PRICE_USD * 12;

const FREE_FEATURES = [
  "Up to 3 accounts & 3 credit cards",
  "Last 30 days of transactions & expenses",
  "Dashboard, categories, and bill subscriptions",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Full history & unlimited accounts and cards",
  "Calendar, savings goals, debts, and invoices",
  "Budget Partner AI assistant",
];

function PlanCard({
  name,
  priceLine,
  subPrice,
  badge,
  featured,
  features,
  ctaLabel,
  disabled,
  loading,
  onSelect,
  isCurrent,
}: {
  name: string;
  priceLine: React.ReactNode;
  subPrice?: React.ReactNode;
  badge?: string;
  featured?: boolean;
  features: string[];
  ctaLabel: string;
  disabled: boolean;
  loading: boolean;
  onSelect: () => void;
  isCurrent: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 shadow-sm transition-all",
        featured
          ? "border-primary bg-primary/[0.04] shadow-md ring-1 ring-primary/20"
          : "border-border bg-card",
        isCurrent && "ring-2 ring-success/40"
      )}
    >
      {badge && (
        <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground">{badge}</Badge>
      )}
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold text-foreground">{name}</h2>
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {priceLine}
        </div>
        {subPrice && <p className="mt-1 text-xs text-muted-foreground">{subPrice}</p>}
      </div>
      <ul className="mb-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="w-full"
        variant={featured ? "default" : "outline"}
        disabled={disabled || loading || isCurrent}
        onClick={onSelect}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating…
          </>
        ) : isCurrent ? (
          "Current plan"
        ) : (
          ctaLabel
        )}
      </Button>
    </div>
  );
}

export function PricingPageClient({
  currentPlan,
  isPro,
  planInterval,
}: {
  currentPlan: "free" | "pro";
  isPro: boolean;
  planInterval: "monthly" | "annual" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<SelectablePlanId | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const annualPrice = proAnnualPriceUsd();

  const isCurrentFree = currentPlan === "free";
  const isCurrentMonthly = isPro && (planInterval === "monthly" || planInterval === null);
  const isCurrentAnnual = isPro && planInterval === "annual";

  function run(id: SelectablePlanId) {
    setMessage(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await selectPlan(id);
      setPendingId(null);
      if (res.ok) {
        setMessage({ type: "ok", text: "Your plan has been updated." });
        router.refresh();
      } else {
        setMessage({ type: "err", text: res.error });
      }
    });
  }

  const busy = (id: SelectablePlanId) => pending && pendingId === id;

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Plans &amp; pricing</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
          Choose how you use Budget Partner HQ. Prices are shown in USD. Payment checkout will
          connect here later; for now your selection is saved on your profile.
        </p>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm text-center",
            message.type === "ok"
              ? "border-success/30 bg-success/10 text-success-800"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <PlanCard
          name="Free"
          priceLine={<span className="font-display text-3xl font-bold text-foreground">$0</span>}
          subPrice="No credit card required."
          features={FREE_FEATURES}
          ctaLabel="Use Free"
          disabled={pending}
          loading={busy("free")}
          onSelect={() => run("free")}
          isCurrent={isCurrentFree}
        />

        <PlanCard
          name="Pro"
          priceLine={
            <>
              <span className="font-display text-3xl font-bold text-foreground">
                {formatPlanMoneyUsd(PRO_MONTHLY_PRICE_USD)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">/month</span>
            </>
          }
          subPrice="Billed monthly when checkout is enabled."
          featured
          features={PRO_FEATURES}
          ctaLabel="Choose Pro"
          disabled={pending}
          loading={busy("pro_monthly")}
          onSelect={() => run("pro_monthly")}
          isCurrent={isCurrentMonthly}
        />

        <PlanCard
          name="Pro Annual"
          priceLine={
            <>
              <span className="font-display text-3xl font-bold text-foreground">
                {formatPlanMoneyUsd(annualPrice)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">/year</span>
            </>
          }
          subPrice={
            <>
              <span className="line-through opacity-70">{formatPlanMoneyUsd(FULL_YEAR_AT_MONTHLY)}</span>
              {" "}if paid monthly for 12 months · Save {PRO_ANNUAL_DISCOUNT_PERCENT}%
            </>
          }
          badge={`Save ${PRO_ANNUAL_DISCOUNT_PERCENT}%`}
          features={PRO_FEATURES}
          ctaLabel="Choose Pro Annual"
          disabled={pending}
          loading={busy("pro_annual")}
          onSelect={() => run("pro_annual")}
          isCurrent={isCurrentAnnual}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Sparkles className="inline h-3.5 w-3.5 align-text-bottom mr-1" aria-hidden />
        Pro Annual = 12 × {formatPlanMoneyUsd(PRO_MONTHLY_PRICE_USD)} with {PRO_ANNUAL_DISCOUNT_PERCENT}% off ={" "}
        {formatPlanMoneyUsd(annualPrice)} per year.
      </p>
    </div>
  );
}
