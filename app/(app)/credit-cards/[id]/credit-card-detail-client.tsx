"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Clock,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency, formatDate, formatPercent, utilColour, TX_TYPE_LABELS, TX_TYPE_COLORS } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/types/database";

type CreditCardRow = Database["public"]["Tables"]["credit_cards"]["Row"];
type Statement = Database["public"]["Tables"]["credit_card_statements"]["Row"];
type InstalmentPlan = Database["public"]["Tables"]["instalment_plans"]["Row"];

type CardWithBalance = CreditCardRow & { outstanding_balance: number };
type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  categories: { name: string; color: string | null } | null;
  merchants: { name: string } | null;
};

const NETWORK_LABELS: Record<string, string> = {
  visa: "💳 Visa",
  mastercard: "💳 Mastercard",
  amex: "💳 Amex",
  jcb: "💳 JCB",
  other: "💳 Card",
};

function UtilisationBar({ pct }: { pct: number }) {
  const colour = utilColour(pct);
  const barClass =
    colour === "green"
      ? "bg-success"
      : colour === "amber"
      ? "bg-warning"
      : "bg-destructive";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Utilisation</span>
        <span
          className={cn(
            "font-semibold",
            colour === "green"
              ? "text-success"
              : colour === "amber"
              ? "text-warning-700"
              : "text-destructive"
          )}
        >
          {formatPercent(pct)}
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClass)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Amortisation table ────────────────────────────────────────────────────────
function AmortisationTable({
  totalAmount,
  months,
  interestRate,
  startMonth,
}: {
  totalAmount: number;
  months: number;
  interestRate: number;
  startMonth: string;
}) {
  const displayCurrency = useDisplayCurrency();
  const rows = useMemo(() => {
    const totalInterest = totalAmount * (interestRate / 100);
    const totalWithInterest = totalAmount + totalInterest;
    const monthlyPayment = months > 0 ? totalWithInterest / months : 0;
    const monthlyInterest = months > 0 ? totalInterest / months : 0;
    const monthlyPrincipal = monthlyPayment - monthlyInterest;

    const result = [];
    let balance = totalAmount;

    const [year, month] = startMonth.split("-").map(Number);

    for (let i = 0; i < Math.min(months, 60); i++) {
      const d = new Date(year, month - 1 + i);
      balance = Math.max(0, balance - monthlyPrincipal);
      result.push({
        month: `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`,
        payment: monthlyPayment,
        interest: monthlyInterest,
        principal: monthlyPrincipal,
        balance,
      });
    }
    return result;
  }, [totalAmount, months, interestRate, startMonth]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-secondary/60 border-b border-border">
              {["Month", "Payment", "Interest", "Principal", "Balance"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.month} className="hover:bg-secondary/30">
                <td className="py-1.5 px-3 whitespace-nowrap">{row.month}</td>
                <td className="py-1.5 px-3 font-mono">
                  {formatCurrency(row.payment, displayCurrency)}
                </td>
                <td className="py-1.5 px-3 font-mono text-warning-700">
                  {formatCurrency(row.interest, displayCurrency)}
                </td>
                <td className="py-1.5 px-3 font-mono text-success">
                  {formatCurrency(row.principal, displayCurrency)}
                </td>
                <td className="py-1.5 px-3 font-mono">
                  {formatCurrency(row.balance, displayCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Amount helpers ────────────────────────────────────────────────────────────
function toDisplayAmount(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, "").replace(/^(\d*\.?\d*).*$/, "$1");
  const [integer, decimal] = clean.split(".");
  const formatted = (integer || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

function parseAmount(display: string): number {
  return parseFloat(display.replace(/,/g, "")) || 0;
}

// ─── Pay Credit Card Dialog ────────────────────────────────────────────────────
type AccountRow = { id: string; name: string; balance: number; currency_code: string };

function PaymentDialog({
  card,
  latestUnpaidStatement,
  open,
  onClose,
  onSuccess,
}: {
  card: CardWithBalance;
  latestUnpaidStatement: Statement | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const [amount, setAmount] = useState(
    toDisplayAmount(card.outstanding_balance.toFixed(2))
  );
  const [fromAccountId, setFromAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  // Fetch user accounts when dialog opens
  useEffect(() => {
    if (!open) return;
    supabase
      .from("accounts")
      .select("id, name, balance, currency_code")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) {
          setAccounts(data);
          if (data.length > 0 && !fromAccountId) setFromAccountId(data[0].id);
        }
      });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const minPayment = (() => {
    if (!card.min_payment_value) return null;
    if (card.min_payment_type === "percentage")
      return card.outstanding_balance * (card.min_payment_value / 100);
    return card.min_payment_value;
  })();

  const quickAmounts = [
    minPayment !== null && { label: "Min payment", value: minPayment },
    latestUnpaidStatement && {
      label: "Statement balance",
      value: latestUnpaidStatement.statement_balance,
    },
    { label: "Full balance", value: card.outstanding_balance },
  ].filter(Boolean) as { label: string; value: number }[];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const paymentAmount = parseAmount(amount);
    if (paymentAmount <= 0) {
      setError("Payment amount must be greater than zero.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "credit_payment",
      credit_card_id: card.id,
      from_account_id: fromAccountId || null,
      amount: paymentAmount,
      currency_code: card.currency_code,
      date,
      description: description || "Credit card payment",
    });

    if (txError) {
      setError(txError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Make a payment</DialogTitle>
          <DialogDescription>
            Record a payment toward <span className="font-medium text-foreground">{card.name}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Outstanding balance banner */}
        <div className="rounded-xl p-4 text-white" style={{ background: card.color ?? "#032e6d" }}>
          <p className="text-xs opacity-70 uppercase tracking-wide font-medium">Outstanding balance</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(card.outstanding_balance, displayCurrency)}
          </p>
          {card.credit_limit > 0 && (
            <p className="text-xs opacity-60 mt-1">
              {formatPercent((card.outstanding_balance / card.credit_limit) * 100)} utilised
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick-fill buttons */}
          {quickAmounts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Quick fill</p>
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setAmount(toDisplayAmount(q.value.toFixed(2)))}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    {q.label}
                    <span className="ml-1.5 text-muted-foreground">
                      {formatCurrency(q.value, displayCurrency)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Payment amount *</Label>
            <Input
              id="pay-amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(toDisplayAmount(e.target.value))}
              placeholder="0.00"
            />
          </div>

          {/* Pay from account */}
          <div className="space-y-2">
            <Label>Pay from account *</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <span>{acc.name}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      {formatCurrency(acc.balance, displayCurrency)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="pay-date">Payment date *</Label>
            <Input
              id="pay-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pay-desc">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="pay-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly payment"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !fromAccountId}>
              {loading ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Instalment Plan Dialog ────────────────────────────────────────────
function CreateInstalmentDialog({
  cardId,
  currency,
  open,
  onClose,
  onSuccess,
}: {
  cardId: string;
  currency: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [months, setMonths] = useState("12");
  const [interestRate, setInterestRate] = useState("0");
  const [startMonth, setStartMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const totalNum = parseFloat(totalAmount) || 0;
  const monthsNum = parseInt(months) || 1;
  const rateNum = parseFloat(interestRate) || 0;
  const totalInterest = totalNum * (rateNum / 100);
  const totalWithInterest = totalNum + totalInterest;
  const monthlyAmount = monthsNum > 0 ? totalWithInterest / monthsNum : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: dbError } = await supabase.from("instalment_plans").insert({
      credit_card_id: cardId,
      description,
      total_amount: totalNum,
      months: monthsNum,
      monthly_amount: monthlyAmount,
      interest_rate: rateNum,
      processing_fee: 0,
      start_month: startMonth + "-01",
      currency_code: currency,
    });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create instalment plan</DialogTitle>
          <DialogDescription>
            Set up a new instalment plan for this card.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ip-desc">Description *</Label>
            <Input
              id="ip-desc"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. MacBook Pro instalment"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ip-amount">Total amount *</Label>
              <Input
                id="ip-amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip-months">Number of months *</Label>
              <Input
                id="ip-months"
                type="number"
                min="1"
                max="120"
                required
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ip-rate">Interest rate (%)</Label>
              <Input
                id="ip-rate"
                type="number"
                min="0"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip-start">Start month *</Label>
              <Input
                id="ip-start"
                type="month"
                required
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
              />
            </div>
          </div>

          {/* Summary */}
          {totalNum > 0 && (
            <div className="rounded-lg bg-secondary/50 border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly payment</span>
                <span className="font-semibold">
                  {formatCurrency(monthlyAmount, displayCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total interest</span>
                <span className="text-warning-700 font-semibold">
                  {formatCurrency(totalInterest, displayCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total cost</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(totalWithInterest, displayCurrency)}
                </span>
              </div>
            </div>
          )}

          {/* Amortisation preview */}
          {totalNum > 0 && monthsNum > 0 && (
            <div className="space-y-2">
              <Label>Amortisation preview</Label>
              <AmortisationTable
                totalAmount={totalNum}
                months={monthsNum}
                interestRate={rateNum}
                startMonth={startMonth + "-01"}
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Client Component ─────────────────────────────────────────────────────
interface Props {
  card: CardWithBalance;
  statements: Statement[];
  transactions: Transaction[];
  instalmentPlans: InstalmentPlan[];
}

export function CreditCardDetailClient({
  card,
  statements,
  transactions,
  instalmentPlans,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const [instalmentOpen, setInstalmentOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const latestUnpaidStatement = statements.find((s) => !s.is_paid) ?? null;

  const utilisationPct =
    card.credit_limit > 0
      ? (card.outstanding_balance / card.credit_limit) * 100
      : 0;

  // Next due date
  const today = new Date();
  const nextDueDate = (() => {
    if (!card.payment_due_day) return null;
    const d = new Date(today.getFullYear(), today.getMonth(), card.payment_due_day);
    if (d < today) d.setMonth(d.getMonth() + 1);
    return d;
  })();

  const daysUntilDue = nextDueDate
    ? Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link href="/credit-cards">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Credit Cards
          </Button>
        </Link>
      </div>

      {/* Card hero */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{ background: card.color ?? "#032e6d" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs opacity-60 uppercase tracking-wider font-medium">
              {NETWORK_LABELS[card.network ?? "other"]}
            </p>
            <h1 className="font-display font-bold text-2xl mt-1">{card.name}</h1>
            <p className="font-mono tracking-widest opacity-70 mt-2 text-sm">
              ●●●● ●●●● ●●●● {card.last_four ?? "****"}
            </p>
          </div>
          {card.outstanding_balance > 0 && (
            <Button
              size="sm"
              onClick={() => setPaymentOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 border backdrop-blur-sm shrink-0"
            >
              <Banknote className="h-4 w-4 mr-1.5" />
              Pay
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-xs opacity-60">Outstanding</p>
            <p className="font-bold text-xl mt-0.5">
              {formatCurrency(card.outstanding_balance, displayCurrency)}
            </p>
          </div>
          <div>
            <p className="text-xs opacity-60">Credit limit</p>
            <p className="font-bold text-xl mt-0.5">
              {formatCurrency(card.credit_limit, displayCurrency)}
            </p>
          </div>
          <div>
            <p className="text-xs opacity-60">Available</p>
            <p className="font-bold text-xl mt-0.5">
              {formatCurrency(
                Math.max(0, card.credit_limit - card.outstanding_balance),
                displayCurrency
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-display font-semibold text-foreground">Overview</h2>
        <UtilisationBar pct={utilisationPct} />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Billing cycle start
            </p>
            <p className="font-semibold text-foreground mt-1">
              Day {card.billing_cycle_start_day ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Payment due day
            </p>
            <p className="font-semibold text-foreground mt-1">
              Day {card.payment_due_day ?? "—"}
            </p>
          </div>
          {nextDueDate && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Next due date
              </p>
              <p
                className={cn(
                  "font-semibold mt-1",
                  daysUntilDue !== null && daysUntilDue <= 7
                    ? "text-warning-700"
                    : "text-foreground"
                )}
              >
                {formatDate(nextDueDate, "MMM d, yyyy")}
                {daysUntilDue !== null && (
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    ({daysUntilDue}d)
                  </span>
                )}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Min payment
            </p>
            <p className="font-semibold text-foreground mt-1">
              {card.min_payment_type === "percentage"
                ? `${card.min_payment_value ?? 0}%`
                : card.min_payment_value
                ? formatCurrency(card.min_payment_value, displayCurrency)
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="statements">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="statements">Statements</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="instalments">Instalment Plans</TabsTrigger>
        </TabsList>

        {/* Statements */}
        <TabsContent value="statements" className="mt-4">
          {statements.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No statements yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      {[
                        "Period",
                        "Statement Balance",
                        "Min Payment",
                        "Paid",
                        "Due Date",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {statements.map((s) => (
                      <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-foreground">
                          {formatDate(s.period_start, "MMM d")} –{" "}
                          {formatDate(s.period_end, "MMM d, yyyy")}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          {formatCurrency(s.statement_balance, displayCurrency)}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {s.minimum_payment
                            ? formatCurrency(s.minimum_payment, displayCurrency)
                            : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-success">
                          {formatCurrency(s.paid_amount, displayCurrency)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                          {formatDate(s.due_date, "MMM d, yyyy")}
                        </td>
                        <td className="py-3 px-4">
                          {s.is_paid ? (
                            <Badge variant="success" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Unpaid
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions" className="mt-4">
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No transactions for this card yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      {["Date", "Type", "Description", "Merchant", "Amount"].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => {
                      const colors =
                        TX_TYPE_COLORS[tx.type] ?? TX_TYPE_COLORS.expense;
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                            {formatDate(tx.date, "MMM d, yyyy")}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                colors.bg,
                                colors.text,
                                colors.border
                              )}
                            >
                              {TX_TYPE_LABELS[tx.type] ?? tx.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-[180px]">
                            <p className="truncate text-foreground">
                              {tx.description ?? (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-foreground whitespace-nowrap">
                            {tx.merchants?.name ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span
                              className={cn(
                                "font-mono font-semibold tabular-nums",
                                tx.type === "credit_charge"
                                  ? "text-destructive"
                                  : "text-success"
                              )}
                            >
                              {tx.type === "credit_charge" ? "-" : "+"}
                              {formatCurrency(tx.amount, displayCurrency)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Instalment Plans */}
        <TabsContent value="instalments" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setInstalmentOpen(true)}>
              <Plus className="h-4 w-4" />
              Create instalment plan
            </Button>
          </div>

          {instalmentPlans.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No instalment plans yet. Create one to track purchases paid in
              instalments.
            </div>
          ) : (
            <div className="space-y-4">
              {instalmentPlans.map((plan) => {
                const startDate = new Date(plan.start_month);
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + plan.months - 1);
                const now = new Date();
                const monthsElapsed = Math.max(
                  0,
                  (now.getFullYear() - startDate.getFullYear()) * 12 +
                    (now.getMonth() - startDate.getMonth())
                );
                const monthsRemaining = Math.max(0, plan.months - monthsElapsed);
                const totalInterestCost =
                  plan.total_amount * (plan.interest_rate / 100);

                return (
                  <div
                    key={plan.id}
                    className="bg-card border border-border rounded-xl p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-foreground">
                          {plan.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(plan.start_month, "MMM yyyy")} –{" "}
                          {formatDate(endDate, "MMM yyyy")} · {plan.months}{" "}
                          months
                        </p>
                      </div>
                      <Badge
                        variant={monthsRemaining > 0 ? "warning" : "success"}
                        className="text-xs shrink-0"
                      >
                        {monthsRemaining > 0
                          ? `${monthsRemaining}mo left`
                          : "Complete"}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                          Total amount
                        </p>
                        <p className="font-semibold text-foreground mt-1">
                          {formatCurrency(plan.total_amount, displayCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                          Monthly
                        </p>
                        <p className="font-semibold text-foreground mt-1">
                          {formatCurrency(plan.monthly_amount, displayCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                          Interest rate
                        </p>
                        <p className="font-semibold text-foreground mt-1">
                          {formatPercent(plan.interest_rate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                          Total interest
                        </p>
                        <p className="font-semibold text-warning-700 mt-1">
                          {formatCurrency(totalInterestCost, displayCurrency)}
                        </p>
                      </div>
                    </div>

                    {monthsRemaining > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{monthsElapsed}/{plan.months} months paid</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                (monthsElapsed / plan.months) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Instalment Dialog */}
      <CreateInstalmentDialog
        cardId={card.id}
        currency={card.currency_code}
        open={instalmentOpen}
        onClose={() => setInstalmentOpen(false)}
        onSuccess={() => setInstalmentOpen(false)}
      />

      {/* Pay Credit Card Dialog */}
      <PaymentDialog
        card={card}
        latestUnpaidStatement={latestUnpaidStatement}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={() => setPaymentOpen(false)}
      />
    </div>
  );
}
