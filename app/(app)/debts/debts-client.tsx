"use client";

import React, { useState } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type Debt = Database["public"]["Tables"]["debts"]["Row"];
type DebtPayment = Database["public"]["Tables"]["debt_payments"]["Row"];
// Credit card with outstanding_balance computed from transactions (server-side)
type CreditCard = Database["public"]["Tables"]["credit_cards"]["Row"] & {
  outstanding_balance: number;
};
type InstalmentPlan = Database["public"]["Tables"]["instalment_plans"]["Row"];
type DebtStrategy = Database["public"]["Tables"]["debt_strategies"]["Row"];
type Account = Pick<Database["public"]["Tables"]["accounts"]["Row"], "id" | "name" | "currency_code">;

// Instalment plan with pre-computed remaining balance
type InstalmentPlanWithRemaining = InstalmentPlan & { remaining: number };

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"];

const DEBT_TYPE_LABELS: Record<string, string> = {
  personal_loan: "Personal Loan",
  government_loan: "Government Loan",
  informal: "Informal",
  other: "Other",
};

const DEBT_TYPE_BADGE_CLASSES = "bg-destructive/10 text-destructive border border-destructive/20";
const CC_BADGE_CLASSES = "bg-primary/10 text-primary border border-primary/20";
const INSTALMENT_BADGE_CLASSES = "bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20";

const METHOD_INFO: Record<string, { label: string; desc: string }> = {
  avalanche: {
    label: "Avalanche Method",
    desc: "Pay off the highest-interest debt first. Minimises total interest paid.",
  },
  snowball: {
    label: "Snowball Method",
    desc: "Pay off the smallest balance first. Builds momentum with quick wins.",
  },
  hybrid: {
    label: "Hybrid Method",
    desc: "Balances both approaches — quick wins for morale, then targets high interest.",
  },
};

/** Radix Select forbids SelectItem value="". */
const NO_LINKED_ACCOUNT_VALUE = "__none__";

function getInstalmentRemaining(ip: InstalmentPlan): number {
  const monthsElapsed = Math.max(
    0,
    Math.floor(
      (new Date().getTime() - new Date(ip.start_month).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    )
  );
  return Math.max(0, (ip.months - monthsElapsed) * ip.monthly_amount);
}

/** Compute the actual monthly minimum payment for a credit card based on its type and outstanding balance. */
function getCCMinPayment(card: CreditCard): number {
  if (!card.min_payment_value) return 0;
  if (card.min_payment_type === "percentage") {
    return card.outstanding_balance * (card.min_payment_value / 100);
  }
  // flat or null — use the fixed value, but cap it to the outstanding balance
  return Math.min(card.min_payment_value, card.outstanding_balance || card.min_payment_value);
}

// ---- Payment History Row ----
function PaymentHistoryRow({ payments }: { payments: DebtPayment[] }) {
  const displayCurrency = useDisplayCurrency();
  const [open, setOpen] = useState(false);

  if (payments.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {payments.length} payment{payments.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-xs px-3 py-1.5 bg-secondary rounded"
            >
              <span className="text-foreground font-medium">
                {formatCurrency(p.amount, displayCurrency)}
              </span>
              <div className="flex gap-3 text-muted-foreground">
                {p.principal_portion != null && (
                  <span>P: {formatCurrency(p.principal_portion, displayCurrency)}</span>
                )}
                {p.interest_portion != null && (
                  <span>I: {formatCurrency(p.interest_portion, displayCurrency)}</span>
                )}
                <span>{formatDate(p.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Debt Card ----
interface DebtCardProps {
  debt: Debt;
  payments: DebtPayment[];
  isFocus: boolean;
  onEdit: (debt: Debt) => void;
  displayCurrency: string;
}

function DebtCard({ debt, payments, isFocus, onEdit, displayCurrency }: DebtCardProps) {
  const paidAmount = (debt.original_amount ?? 0) - debt.current_balance;
  const progressPct =
    debt.original_amount != null && debt.original_amount > 0
      ? Math.min(100, Math.max(0, (paidAmount / debt.original_amount) * 100))
      : null;

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-4 space-y-3 flex flex-col",
        isFocus && "ring-2 ring-accent"
      )}
    >
      {/* Row 1: name + badges + edit */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground truncate">{debt.name}</span>
          <Badge className={DEBT_TYPE_BADGE_CLASSES}>
            {DEBT_TYPE_LABELS[debt.type] ?? debt.type}
          </Badge>
          {isFocus && (
            <Badge className="bg-accent/20 text-accent-foreground border border-accent/40">
              Focus
            </Badge>
          )}
        </div>
        <button
          onClick={() => onEdit(debt)}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lender */}
      {debt.lender_name && (
        <p className="text-xs text-muted-foreground -mt-1">via {debt.lender_name}</p>
      )}

      {/* Progress bar */}
      {progressPct !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(debt.current_balance, displayCurrency)} remaining</span>
            <span>of {formatCurrency(debt.original_amount!, displayCurrency)}</span>
          </div>
          <Progress value={progressPct} indicatorClassName="bg-emerald-500" />
        </div>
      )}

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {debt.interest_rate != null && (
          <Badge variant="outline" className="font-normal">
            {debt.interest_rate}% p.a.
          </Badge>
        )}
        {debt.monthly_payment != null && (
          <span>{formatCurrency(debt.monthly_payment, displayCurrency)} / mo</span>
        )}
        {debt.payment_due_day != null && (
          <span>Due day {debt.payment_due_day}</span>
        )}
      </div>

      {/* Payment history */}
      <PaymentHistoryRow payments={payments} />
    </div>
  );
}

// ---- Instalment Card ----
interface InstalmentCardProps {
  plan: InstalmentPlanWithRemaining;
  creditCardName: string;
  isFocus: boolean;
  displayCurrency: string;
}

function InstalmentCard({ plan, creditCardName, isFocus, displayCurrency }: InstalmentCardProps) {
  const progressPct =
    plan.total_amount > 0
      ? Math.min(100, Math.max(0, ((plan.total_amount - plan.remaining) / plan.total_amount) * 100))
      : null;

  const monthsElapsed = Math.max(
    0,
    Math.floor(
      (new Date().getTime() - new Date(plan.start_month).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    )
  );
  const monthsLeft = Math.max(0, plan.months - monthsElapsed);

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-4 space-y-3 flex flex-col",
        isFocus && "ring-2 ring-accent"
      )}
    >
      {/* Row 1: name + badges */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="font-semibold text-foreground truncate">{plan.description}</span>
        <Badge className={INSTALMENT_BADGE_CLASSES}>Instalment Plan</Badge>
        {isFocus && (
          <Badge className="bg-accent/20 text-accent-foreground border border-accent/40">
            Focus
          </Badge>
        )}
      </div>

      {/* Credit card lender */}
      <p className="text-xs text-muted-foreground -mt-1">via {creditCardName}</p>

      {/* Progress bar */}
      {progressPct !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(plan.remaining, displayCurrency)} remaining</span>
            <span>of {formatCurrency(plan.total_amount, displayCurrency)}</span>
          </div>
          <Progress value={progressPct} indicatorClassName="bg-[#7c3aed]" />
        </div>
      )}

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {plan.interest_rate != null && plan.interest_rate > 0 && (
          <Badge variant="outline" className="font-normal">
            {plan.interest_rate}% p.a.
          </Badge>
        )}
        <span>{formatCurrency(plan.monthly_amount, displayCurrency)} / mo</span>
        <span>{monthsLeft} month{monthsLeft !== 1 ? "s" : ""} left</span>
      </div>
    </div>
  );
}

// ---- Credit Card Debt Card ----
interface CreditCardDebtCardProps {
  card: CreditCard;
  outstanding: number;
  minPayment: number;
  isFocus: boolean;
  displayCurrency: string;
}

function CreditCardDebtCard({ card, outstanding, minPayment, isFocus, displayCurrency }: CreditCardDebtCardProps) {
  const utilizationPct = card.credit_limit > 0
    ? Math.min(100, Math.max(0, (outstanding / card.credit_limit) * 100))
    : 0;

  const barColor =
    utilizationPct > 80 ? "bg-destructive" :
    utilizationPct > 50 ? "bg-yellow-500" :
    "bg-primary";

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-4 space-y-3 flex flex-col",
        isFocus && "ring-2 ring-accent"
      )}
    >
      {/* Row 1: name + badges */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="font-semibold text-foreground truncate">
          {card.name}{card.last_four ? ` ···${card.last_four}` : ""}
        </span>
        <Badge className={CC_BADGE_CLASSES}>Credit Card</Badge>
        {isFocus && (
          <Badge className="bg-accent/20 text-accent-foreground border border-accent/40">
            Focus
          </Badge>
        )}
      </div>

      {/* Utilisation bar — always shown */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {formatCurrency(outstanding, displayCurrency)}
            </span>
            {" "}outstanding
          </span>
          <span>{formatCurrency(card.credit_limit, displayCurrency)} limit</span>
        </div>
        <Progress value={utilizationPct} indicatorClassName={barColor} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span style={{ color: utilizationPct > 80 ? "#ef4444" : utilizationPct > 50 ? "#ca8a04" : undefined }}>
            {utilizationPct.toFixed(1)}% utilised
          </span>
          <span>{formatCurrency(card.credit_limit - outstanding, displayCurrency)} available</span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {minPayment > 0 && (
          <span>
            {formatCurrency(minPayment, displayCurrency)} min / mo
            {card.min_payment_type === "percentage" && card.min_payment_value != null && (
              <span className="text-muted-foreground/60 ml-1">({card.min_payment_value}%)</span>
            )}
          </span>
        )}
        {card.payment_due_day != null && (
          <span>Due day {card.payment_due_day}</span>
        )}
      </div>

      {outstanding === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">
          No unpaid statements logged yet.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60 italic">
          Interest not factored in — current balance only.
        </p>
      )}
    </div>
  );
}

// ---- Payoff Calculator ----
function PayoffCalculator({
  debts,
  instalmentPlans,
  creditCardsWithBalance,
  extraPayment,
  recommendedMethod,
}: {
  debts: Debt[];
  instalmentPlans: InstalmentPlanWithRemaining[];
  creditCardsWithBalance: { balance: number; minPayment: number }[];
  extraPayment: number;
  recommendedMethod: string | null;
}) {
  const displayCurrency = useDisplayCurrency();

  function calcScenario(method: "current" | "snowball" | "avalanche") {
    // Build payable items from debts
    const debtItems = debts
      .filter((d) => d.monthly_payment && d.monthly_payment > 0)
      .map((d) => ({
        balance: d.current_balance,
        rate: (d.interest_rate ?? 0) / 100 / 12,
        payment: d.monthly_payment!,
      }));

    // Build payable items from instalment plans
    const instalmentItems = instalmentPlans
      .filter((ip) => ip.remaining > 0 && ip.monthly_amount > 0)
      .map((ip) => ({
        balance: ip.remaining,
        rate: (ip.interest_rate ?? 0) / 100 / 12,
        payment: ip.monthly_amount,
      }));

    // Build payable items from credit card outstanding balances (0% rate — current balance only)
    const ccItems = creditCardsWithBalance
      .filter((cc) => cc.balance > 0 && cc.minPayment > 0)
      .map((cc) => ({
        balance: cc.balance,
        rate: 0,
        payment: cc.minPayment,
      }));

    const allItems = [...debtItems, ...instalmentItems, ...ccItems];
    if (allItems.length === 0) return { date: null, interest: 0 };

    let sorted = [...allItems];
    if (method === "avalanche") {
      sorted = [...allItems].sort((a, b) => b.rate - a.rate);
    } else if (method === "snowball") {
      sorted = [...allItems].sort((a, b) => a.balance - b.balance);
    }

    let extra = extraPayment;
    let months = 0;
    let totalInterest = 0;
    const maxMonths = 600;

    while (sorted.some((i) => i.balance > 0) && months < maxMonths) {
      months++;
      let availableExtra = extra;

      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].balance <= 0) continue;
        const interest = sorted[i].balance * sorted[i].rate;
        totalInterest += interest;
        const payment = sorted[i].payment + (i === 0 ? availableExtra : 0);
        const principal = Math.min(payment - interest, sorted[i].balance);
        sorted[i].balance -= Math.max(0, principal);
        if (sorted[i].balance <= 0) {
          availableExtra += sorted[i].payment;
        }
      }
    }

    if (months >= maxMonths) return { date: null, interest: totalInterest };
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return { date, interest: totalInterest };
  }

  const current = calcScenario("current");
  const snowball = calcScenario("snowball");
  const avalanche = calcScenario("avalanche");

  const scenarios = [
    { key: "current", label: "Current Pace", result: current, color: "#6b6350" },
    { key: "snowball", label: "Snowball", result: snowball, color: "#cea843" },
    { key: "avalanche", label: "Avalanche", result: avalanche, color: "#28c095" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {scenarios.map((s) => {
        const isRecommended = s.key === recommendedMethod;
        return (
          <div
            key={s.key}
            className={cn(
              "bg-card border border-border rounded-lg p-4 text-center transition-all",
              isRecommended && "bg-accent/5 border-2"
            )}
            style={{
              borderTopColor: s.color,
              borderTopWidth: isRecommended ? 4 : 3,
            }}
          >
            {isRecommended && (
              <Badge variant="accent" className="mb-2 text-xs">
                Recommended
              </Badge>
            )}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {s.label}
            </p>
            <p className="text-lg font-display font-bold text-foreground">
              {s.result.date ? formatDate(s.result.date, "MMM yyyy") : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">debt-free date</p>
            <Separator className="my-3" />
            <p className="text-sm font-semibold" style={{ color: s.color }}>
              {formatCurrency(s.result.interest, displayCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">total interest</p>
          </div>
        );
      })}
    </div>
  );
}

// ---- Debt Form ----
function DebtForm({
  debt,
  accounts,
  onSuccess,
  onClose,
}: {
  debt?: Debt;
  accounts: Account[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(debt?.name ?? "");
  const [type, setType] = useState<Debt["type"]>(debt?.type ?? "personal_loan");
  const [lenderName, setLenderName] = useState(debt?.lender_name ?? "");
  const [originalAmount, setOriginalAmount] = useState(String(debt?.original_amount ?? ""));
  const [currentBalance, setCurrentBalance] = useState(String(debt?.current_balance ?? ""));
  const [interestRate, setInterestRate] = useState(String(debt?.interest_rate ?? "0"));
  const [monthlyPayment, setMonthlyPayment] = useState(String(debt?.monthly_payment ?? ""));
  const [paymentDueDay, setPaymentDueDay] = useState(String(debt?.payment_due_day ?? ""));
  const [startDate, setStartDate] = useState(debt?.start_date ?? "");
  const [expectedEndDate, setExpectedEndDate] = useState(debt?.expected_end_date ?? "");
  const [currency, setCurrency] = useState(debt?.currency_code ?? "PHP");
  const [linkedAccountId, setLinkedAccountId] = useState(debt?.linked_account_id ?? "");
  const [notes, setNotes] = useState(debt?.notes ?? "");
  const [status, setStatus] = useState<Debt["status"]>(debt?.status ?? "active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const payload = {
      name,
      type,
      lender_name: lenderName || null,
      original_amount: parseFloat(originalAmount) || 0,
      current_balance: parseFloat(currentBalance) || 0,
      interest_rate: parseFloat(interestRate) || 0,
      monthly_payment: parseFloat(monthlyPayment) || null,
      payment_due_day: parseInt(paymentDueDay) || null,
      start_date: startDate || null,
      expected_end_date: expectedEndDate || null,
      currency_code: currency,
      linked_account_id: linkedAccountId || null,
      notes: notes || null,
      status,
    };

    const { error: dbErr } = debt
      ? await supabase.from("debts").update(payload).eq("id", debt.id)
      : await supabase.from("debts").insert({ ...payload, user_id: user.id });

    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="debt-name">Name *</Label>
        <Input
          id="debt-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. SSS Salary Loan"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type *</Label>
          <Select value={type} onValueChange={(v) => setType(v as Debt["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DEBT_TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-lender">Lender</Label>
          <Input
            id="debt-lender"
            value={lenderName}
            onChange={(e) => setLenderName(e.target.value)}
            placeholder="e.g. SSS"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="debt-original">Original amount *</Label>
          <Input
            id="debt-original"
            type="number"
            min="0"
            step="0.01"
            required
            value={originalAmount}
            onChange={(e) => setOriginalAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-balance">Current balance *</Label>
          <Input
            id="debt-balance"
            type="number"
            min="0"
            step="0.01"
            required
            value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="debt-rate">Interest rate %</Label>
          <Input
            id="debt-rate"
            type="number"
            min="0"
            step="0.01"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-payment">Monthly payment</Label>
          <Input
            id="debt-payment"
            type="number"
            min="0"
            step="0.01"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-due-day">Due day</Label>
          <Input
            id="debt-due-day"
            type="number"
            min="1"
            max="31"
            value={paymentDueDay}
            onChange={(e) => setPaymentDueDay(e.target.value)}
            placeholder="15"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="debt-start">Start date</Label>
          <Input
            id="debt-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-end">Expected end date</Label>
          <Input
            id="debt-end"
            type="date"
            value={expectedEndDate}
            onChange={(e) => setExpectedEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Linked account</Label>
        <Select
          value={linkedAccountId || NO_LINKED_ACCOUNT_VALUE}
          onValueChange={(v) =>
            setLinkedAccountId(v === NO_LINKED_ACCOUNT_VALUE ? "" : v)
          }
        >
          <SelectTrigger><SelectValue placeholder="No linked account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_LINKED_ACCOUNT_VALUE}>No linked account</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as Debt["status"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="paid_off">Paid Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="debt-notes">Notes</Label>
        <Textarea
          id="debt-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          rows={2}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving…" : debt ? "Update debt" : "Add debt"}
      </Button>
    </form>
  );
}

// ---- Main Page Client ----
interface Props {
  initialDebts: Debt[];
  debtPayments: DebtPayment[];
  creditCards: CreditCard[];
  instalmentPlans: InstalmentPlan[];
  debtStrategy: DebtStrategy | null;
  accounts: Account[];
  avgMonthlyIncome: number;
}

export function DebtsPageClient({
  initialDebts,
  debtPayments,
  creditCards,
  instalmentPlans,
  debtStrategy,
  accounts,
  avgMonthlyIncome,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>();
  const [extraPayment, setExtraPayment] = useState(
    debtStrategy?.extra_monthly_payment ?? 0
  );
  const [reEvaluating, setReEvaluating] = useState(false);
  const [reEvalError, setReEvalError] = useState<string | null>(null);

  // Pre-compute remaining balances for instalment plans
  const instalmentPlansWithRemaining: InstalmentPlanWithRemaining[] = instalmentPlans.map(
    (ip) => ({ ...ip, remaining: getInstalmentRemaining(ip) })
  );

  // Totals — credit cards use outstanding_balance computed from transactions (server-side)
  const totalDebt =
    initialDebts.reduce((s, d) => s + d.current_balance, 0) +
    instalmentPlansWithRemaining.reduce((s, ip) => s + ip.remaining, 0) +
    creditCards.reduce((s, c) => s + c.outstanding_balance, 0);

  const totalMinPayments =
    initialDebts.reduce((s, d) => s + (d.monthly_payment ?? 0), 0) +
    instalmentPlansWithRemaining.reduce((s, ip) => s + ip.monthly_amount, 0) +
    creditCards.reduce((s, c) => s + getCCMinPayment(c), 0);

  // DTI
  const dtiRatio = avgMonthlyIncome > 0 ? (totalMinPayments / avgMonthlyIncome) * 100 : 0;
  const dtiColor = dtiRatio < 30 ? "#28c095" : dtiRatio <= 40 ? "#cea843" : "#ef4444";
  const dtiLabel = dtiRatio < 30 ? "Healthy" : dtiRatio <= 40 ? "Watch Out" : "High Risk";

  // Unified sorted ledger: debts + instalments + credit cards (with outstanding balance)
  const method = debtStrategy?.recommended_method ?? null;

  type LedgerItem =
    | { kind: "debt"; id: string; balance: number; rate: number }
    | { kind: "instalment"; id: string; balance: number; rate: number }
    | { kind: "credit_card"; id: string; balance: number; rate: number };

  const ledgerItems: LedgerItem[] = [
    ...initialDebts.map((d) => ({
      kind: "debt" as const,
      id: d.id,
      balance: d.current_balance,
      rate: d.interest_rate ?? 0,
    })),
    ...instalmentPlansWithRemaining.map((ip) => ({
      kind: "instalment" as const,
      id: ip.id,
      balance: ip.remaining,
      rate: ip.interest_rate ?? 0,
    })),
    ...creditCards.map((c) => ({
      kind: "credit_card" as const,
      id: c.id,
      balance: c.outstanding_balance,
      rate: 0, // APR not stored — current balance only, no interest simulation
    })),
  ];

  const sortedLedgerItems = [...ledgerItems].sort((a, b) => {
    if (method === "avalanche" || method === "hybrid") return b.rate - a.rate;
    if (method === "snowball") return a.balance - b.balance;
    return 0;
  });

  const focusItem = sortedLedgerItems[0] ?? null;

  const activeCount = initialDebts.length + instalmentPlansWithRemaining.length + creditCards.length;

  function openNew() {
    setEditingDebt(undefined);
    setSheetOpen(true);
  }

  function openEdit(debt: Debt) {
    setEditingDebt(debt);
    setSheetOpen(true);
  }

  async function handleReEvaluate() {
    setReEvaluating(true);
    setReEvalError(null);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "run_strategy_recommendation",
            arguments: { extra_monthly_payment: extraPayment },
          },
          id: 1,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setReEvalError(json.error.message ?? "Re-evaluation failed.");
      } else {
        router.refresh();
      }
    } catch {
      setReEvalError("Network error. Please try again.");
    } finally {
      setReEvaluating(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Summary Strip ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground sm:text-3xl">Debts</h1>
          <Button onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4" />
            Add debt
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Debt</p>
            <p className="text-xl font-display font-bold text-foreground mt-1 truncate">
              {formatCurrency(totalDebt, displayCurrency)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Liabilities</p>
            <p className="text-xl font-display font-bold text-foreground mt-1">{activeCount}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Min.</p>
            <p className="text-xl font-display font-bold text-destructive mt-1 truncate">
              {formatCurrency(totalMinPayments, displayCurrency)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">DTI Ratio</p>
            <p className="text-xl font-display font-bold mt-1" style={{ color: dtiColor }}>
              {avgMonthlyIncome > 0 ? `${dtiRatio.toFixed(1)}%` : "—"}
            </p>
            <Badge
              className="mt-1 text-xs"
              style={{
                background: `${dtiColor}20`,
                color: dtiColor,
                borderColor: `${dtiColor}40`,
              }}
            >
              {dtiLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Strategy Panel ── */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Repayment Strategy</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full shrink-0 sm:w-auto"
            onClick={handleReEvaluate}
            disabled={reEvaluating}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", reEvaluating && "animate-spin")} />
            {reEvaluating ? "Evaluating…" : "Re-evaluate"}
          </Button>
        </div>

        {debtStrategy?.recommended_method ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="accent" className="capitalize text-sm px-3 py-1">
                {debtStrategy.recommended_method}
              </Badge>
              <p className="text-sm font-semibold text-foreground">
                {METHOD_INFO[debtStrategy.recommended_method]?.label}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {METHOD_INFO[debtStrategy.recommended_method]?.desc}
            </p>
            {debtStrategy.recommendation_reasoning && (
              <p className="text-xs text-muted-foreground border-l-2 border-accent pl-3 italic">
                {debtStrategy.recommendation_reasoning}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No strategy evaluated yet. Click &ldquo;Re-evaluate&rdquo; to get a recommendation based on your current debts.
          </p>
        )}

        {reEvalError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {reEvalError}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Extra monthly payment</Label>
            <span className="text-sm font-semibold text-foreground">
              {formatCurrency(extraPayment, displayCurrency)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50000}
            step={500}
            value={extraPayment}
            onChange={(e) => setExtraPayment(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(0, displayCurrency)}</span>
            <span>{formatCurrency(50000, displayCurrency)}</span>
          </div>
        </div>
      </div>

      {/* ── All Liabilities ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          All Liabilities
        </h2>
        {sortedLedgerItems.length === 0 ? (
          <div className="bg-card border border-border rounded-lg py-12 text-center text-muted-foreground text-sm">
            No active debts recorded.{" "}
            <button
              onClick={openNew}
              className="text-foreground underline underline-offset-2 hover:no-underline"
            >
              Add your first debt
            </button>{" "}
            to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedLedgerItems.map((item) => {
              const isFocus = focusItem?.id === item.id && focusItem?.kind === item.kind;

              if (item.kind === "debt") {
                const debt = initialDebts.find((d) => d.id === item.id)!;
                return (
                  <DebtCard
                    key={`debt-${debt.id}`}
                    debt={debt}
                    payments={debtPayments.filter((p) => p.debt_id === debt.id)}
                    isFocus={isFocus}
                    onEdit={openEdit}
                    displayCurrency={displayCurrency}
                  />
                );
              }

              if (item.kind === "instalment") {
                const plan = instalmentPlansWithRemaining.find((ip) => ip.id === item.id)!;
                const linkedCard = creditCards.find((c) => c.id === plan.credit_card_id);
                const cardName = linkedCard
                  ? `${linkedCard.name}${linkedCard.last_four ? ` ···${linkedCard.last_four}` : ""}`
                  : "Credit Card";
                return (
                  <InstalmentCard
                    key={`instalment-${plan.id}`}
                    plan={plan}
                    creditCardName={cardName}
                    isFocus={isFocus}
                    displayCurrency={displayCurrency}
                  />
                );
              }

              // credit_card
              const card = creditCards.find((c) => c.id === item.id)!;
              return (
                <CreditCardDebtCard
                  key={`cc-${card.id}`}
                  card={card}
                  outstanding={card.outstanding_balance}
                  minPayment={getCCMinPayment(card)}
                  isFocus={isFocus}
                  displayCurrency={displayCurrency}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Payoff Calculator ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Payoff Calculator
        </h2>
        <PayoffCalculator
          debts={initialDebts}
          instalmentPlans={instalmentPlansWithRemaining}
          creditCardsWithBalance={creditCards.map((c) => ({
            balance: c.outstanding_balance,
            minPayment: getCCMinPayment(c),
          }))}
          extraPayment={extraPayment}
          recommendedMethod={method}
        />
      </div>

      {/* ── Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingDebt ? "Edit debt" : "Add debt"}</SheetTitle>
            <SheetDescription>
              {editingDebt ? "Update debt record." : "Record a new liability."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <DebtForm
              debt={editingDebt}
              accounts={accounts}
              onSuccess={() => setSheetOpen(false)}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
