"use client";

import React, { useState } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Gauge,
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
import { formatCurrency, formatDate, calcDebtFreeDate, cn } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type Debt = Database["public"]["Tables"]["debts"]["Row"];
type DebtPayment = Database["public"]["Tables"]["debt_payments"]["Row"];
type CreditCard = Database["public"]["Tables"]["credit_cards"]["Row"];
type InstalmentPlan = Database["public"]["Tables"]["instalment_plans"]["Row"];
type DebtStrategy = Database["public"]["Tables"]["debt_strategies"]["Row"];
type Account = Pick<Database["public"]["Tables"]["accounts"]["Row"], "id" | "name" | "currency_code">;

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"];

const DEBT_TYPE_LABELS: Record<string, string> = {
  personal_loan: "Personal Loan",
  government_loan: "Government Loan",
  informal: "Informal",
  other: "Other",
};

/** Radix Select forbids SelectItem value="". */
const NO_LINKED_ACCOUNT_VALUE = "__none__";

// ---- Unified Ledger Row type ----
interface LedgerRow {
  id: string;
  name: string;
  type: string;
  balance: number;
  interestRate: number | null;
  minPayment: number | null;
  dueDay: number | null;
  currency: string;
  category: "debt" | "credit_card" | "instalment";
  sourceId: string;
}

function buildLedger(
  debts: Debt[],
  creditCards: CreditCard[],
  instalments: InstalmentPlan[]
): LedgerRow[] {
  const rows: LedgerRow[] = [];

  debts.forEach((d) => {
    rows.push({
      id: d.id,
      name: d.name,
      type: DEBT_TYPE_LABELS[d.type] ?? d.type,
      balance: d.current_balance,
      interestRate: d.interest_rate,
      minPayment: d.monthly_payment,
      dueDay: d.payment_due_day,
      currency: d.currency_code,
      category: "debt",
      sourceId: d.id,
    });
  });

  creditCards.forEach((c) => {
    rows.push({
      id: c.id,
      name: c.name + (c.last_four ? ` ···${c.last_four}` : ""),
      type: "Credit Card",
      balance: c.credit_limit,
      interestRate: null,
      minPayment: c.min_payment_value,
      dueDay: c.payment_due_day,
      currency: c.currency_code,
      category: "credit_card",
      sourceId: c.id,
    });
  });

  instalments.forEach((ip) => {
    const monthsElapsed = Math.max(
      0,
      Math.floor(
        (new Date().getTime() - new Date(ip.start_month).getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    );
    const remaining = Math.max(0, (ip.months - monthsElapsed) * ip.monthly_amount);
    rows.push({
      id: ip.id,
      name: ip.description,
      type: "Instalment Plan",
      balance: remaining,
      interestRate: ip.interest_rate,
      minPayment: ip.monthly_amount,
      dueDay: null,
      currency: ip.currency_code,
      category: "instalment",
      sourceId: ip.id,
    });
  });

  return rows;
}

// ---- DTI Gauge ----
function DTIGauge({
  totalMinPayments,
  avgMonthlyIncome,
}: {
  totalMinPayments: number;
  avgMonthlyIncome: number;
}) {
  const displayCurrency = useDisplayCurrency();
  const ratio = avgMonthlyIncome > 0 ? (totalMinPayments / avgMonthlyIncome) * 100 : 0;
  const capped = Math.min(100, ratio);

  const color =
    ratio < 30 ? "#28c095" : ratio <= 40 ? "#cea843" : "#ef4444";
  const label =
    ratio < 30 ? "Healthy" : ratio <= 40 ? "Watch Out" : "High Risk";

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Debt-to-income ratio</h2>
        <Badge
          className="ml-auto"
          style={{
            background: `${color}20`,
            color,
            borderColor: `${color}40`,
          }}
        >
          {label}
        </Badge>
      </div>

      <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${capped}%`, background: color }}
        />
        {/* Threshold markers */}
        <div className="absolute left-[30%] top-0 h-full w-px bg-foreground/20" />
        <div className="absolute left-[40%] top-0 h-full w-px bg-foreground/20" />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
        <span>0%</span>
        <span>30%</span>
        <span>40%</span>
        <span>100%</span>
      </div>

      <div className="flex items-baseline gap-2 mt-4">
        <span className="text-2xl font-display font-bold" style={{ color }}>
          {ratio.toFixed(1)}%
        </span>
        <span className="text-sm text-muted-foreground">
          {formatCurrency(totalMinPayments, displayCurrency)} / mo minimum payments
        </span>
      </div>
      {avgMonthlyIncome === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Add income data via the financial health snapshot to see a ratio.
        </p>
      )}
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

// ---- Payoff Calculator ----
function PayoffCalculator({
  debts,
  extraPayment,
}: {
  debts: Debt[];
  extraPayment: number;
}) {
  const displayCurrency = useDisplayCurrency();
  function calcScenario(method: "current" | "snowball" | "avalanche") {
    if (debts.length === 0) return { date: null, interest: 0 };

    const items = debts
      .filter((d) => d.monthly_payment && d.monthly_payment > 0)
      .map((d) => ({
        balance: d.current_balance,
        rate: d.interest_rate / 100 / 12,
        payment: d.monthly_payment!,
        interest: 0,
      }));

    if (items.length === 0) return { date: null, interest: 0 };

    let sorted = [...items];
    if (method === "avalanche") {
      sorted = [...items].sort(
        (a, b) => b.rate - a.rate
      );
    } else if (method === "snowball") {
      sorted = [...items].sort((a, b) => a.balance - b.balance);
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
        sorted[i].interest += interest;
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
    { label: "Current Pace", result: current, color: "#6b6350" },
    { label: "Snowball", result: snowball, color: "#cea843" },
    { label: "Avalanche", result: avalanche, color: "#28c095" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {scenarios.map((s) => (
        <div
          key={s.label}
          className="bg-card border border-border rounded-lg p-4 text-center"
          style={{ borderTopColor: s.color, borderTopWidth: 3 }}
        >
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
      ))}
    </div>
  );
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>();
  const [extraPayment, setExtraPayment] = useState(
    debtStrategy?.extra_monthly_payment ?? 0
  );

  const ledger = buildLedger(initialDebts, creditCards, instalmentPlans);

  const totalDebt = ledger.reduce((s, r) => s + r.balance, 0);
  const totalMinPayments = ledger.reduce((s, r) => s + (r.minPayment ?? 0), 0);

  function openNew() {
    setEditingDebt(undefined);
    setSheetOpen(true);
  }

  function openEdit(debt: Debt) {
    setEditingDebt(debt);
    setSheetOpen(true);
  }

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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Total liabilities (Unified Debt Ledger)</p>
          <p className="mt-0.5 text-2xl font-display font-bold text-foreground sm:text-3xl">
            {formatCurrency(totalDebt, displayCurrency)}
          </p>
        </div>
        <Button onClick={openNew} className="w-full shrink-0 sm:w-auto">
          <Plus className="h-4 w-4" />
          Add debt
        </Button>
      </div>

      {/* Unified Ledger Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Debt</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Balance</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Interest</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Min Payment</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No liabilities recorded.
                  </td>
                </tr>
              ) : (
                ledger.map((row) => {
                  const debt = initialDebts.find((d) => d.id === row.sourceId);
                  const payments = debt
                    ? debtPayments.filter((p) => p.debt_id === debt.id)
                    : [];

                  return (
                    <React.Fragment key={row.id}>
                      <tr className="border-b border-border hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.type}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(row.balance, displayCurrency)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {row.interestRate != null ? `${row.interestRate}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {row.minPayment != null
                            ? formatCurrency(row.minPayment, displayCurrency)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {row.dueDay != null ? `Day ${row.dueDay}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {debt && (
                            <button
                              onClick={() => openEdit(debt)}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {payments.length > 0 && (
                        <tr className="border-b border-border">
                          <td colSpan={7} className="px-4 pb-3">
                            <PaymentHistoryRow payments={payments} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {ledger.length > 0 && (
              <tfoot>
                <tr className="bg-secondary border-t-2 border-border">
                  <td className="px-4 py-3 font-bold text-foreground" colSpan={2}>
                    TOTAL DEBT
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">
                    {formatCurrency(totalDebt, displayCurrency)}
                  </td>
                  <td colSpan={4} />
                </tr>
                <tr className="bg-secondary border-t border-border">
                  <td className="px-4 py-3 font-bold text-foreground" colSpan={2}>
                    MONTHLY MINIMUMS
                  </td>
                  <td colSpan={2} />
                  <td className="px-4 py-3 text-right font-bold text-destructive">
                    {formatCurrency(totalMinPayments, displayCurrency)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* DTI Gauge */}
      <DTIGauge
        totalMinPayments={totalMinPayments}
        avgMonthlyIncome={avgMonthlyIncome}
      />

      {/* Debt Strategy */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Debt repayment strategy</h2>
          </div>
          <Button size="sm" variant="outline" className="w-full shrink-0 sm:w-auto">
            <RefreshCw className="h-3.5 w-3.5" />
            Re-evaluate
          </Button>
        </div>

        {debtStrategy?.recommended_method ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="accent" className="capitalize">
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
            No strategy evaluated yet. Click &ldquo;Re-evaluate&rdquo; to get a recommendation.
          </p>
        )}

        <Separator />

        {/* Extra payment slider */}
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

      {/* Payoff Calculator */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Payoff Calculator
        </h2>
        <PayoffCalculator
          debts={initialDebts}
          extraPayment={extraPayment}
        />
      </div>

      {/* Sheet */}
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
