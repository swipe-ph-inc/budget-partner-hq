"use client";

import React, { useState } from "react";
import {
  Plus,
  AlertTriangle,
  Pause,
  Play,
  XCircle,
  Pencil,
  CreditCard,
  Wallet,
  RefreshCcw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import {
  sanitizeMoneyInputNonNegative,
  formatMoneyInputDisplay,
  parseMoneyInput,
  numericToMoneyRaw,
} from "@/lib/money-input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
type CreditCard = Pick<Database["public"]["Tables"]["credit_cards"]["Row"], "id" | "name" | "last_four" | "currency_code">;
type Account = Pick<Database["public"]["Tables"]["accounts"]["Row"], "id" | "name" | "currency_code">;
type Category = Pick<Database["public"]["Tables"]["categories"]["Row"], "id" | "name">;

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"];

const CYCLE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const CYCLE_MULTIPLIERS: Record<string, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

/** Radix Select forbids SelectItem value="" — use sentinel for "no category". */
const NO_CATEGORY_SELECT_VALUE = "__none__";

function toMonthly(amount: number, cycle: string): number {
  return amount * (CYCLE_MULTIPLIERS[cycle] ?? 1);
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isUnused(sub: Subscription): boolean {
  if (!sub.last_billed_date) return false;
  const daysSince = -daysUntil(sub.last_billed_date);
  return daysSince > 60;
}

function avatarColor(name: string): string {
  const colors = [
    "#032e6d", "#28c095", "#cea843", "#ef4444",
    "#8b5cf6", "#f97316", "#06b6d4", "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ---- Subscription Form ----
function SubscriptionForm({
  subscription,
  creditCards,
  accounts,
  categories,
  onSuccess,
  onClose,
}: {
  subscription?: Subscription;
  creditCards: CreditCard[];
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(subscription?.name ?? "");
  const [provider, setProvider] = useState(subscription?.provider ?? "");
  const [billingCycle, setBillingCycle] = useState<Subscription["billing_cycle"]>(
    subscription?.billing_cycle ?? "monthly"
  );
  const [amount, setAmount] = useState(
    subscription != null ? numericToMoneyRaw(subscription.amount) : ""
  );
  const [currency, setCurrency] = useState(subscription?.currency_code ?? "PHP");
  const [feeAmount, setFeeAmount] = useState(
    subscription != null ? numericToMoneyRaw(subscription.fee_amount) : ""
  );
  const [paymentMethodType, setPaymentMethodType] = useState<Subscription["payment_method_type"]>(
    subscription?.payment_method_type ?? "account"
  );
  const [creditCardId, setCreditCardId] = useState(subscription?.credit_card_id ?? "");
  const [accountId, setAccountId] = useState(subscription?.account_id ?? "");
  const [categoryId, setCategoryId] = useState(subscription?.category_id ?? "");
  const [nextBillingDate, setNextBillingDate] = useState(
    subscription?.next_billing_date ?? new Date().toISOString().slice(0, 10)
  );
  const [autoLog, setAutoLog] = useState(subscription?.auto_log_transaction ?? false);
  const [status, setStatus] = useState<Subscription["status"]>(subscription?.status ?? "active");
  const [notes, setNotes] = useState(subscription?.notes ?? "");
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

    const amountNum = parseMoneyInput(amount);
    if (amountNum === null || amountNum <= 0) {
      setError("Enter a valid subscription amount greater than zero.");
      setLoading(false);
      return;
    }
    const feeNum = parseMoneyInput(feeAmount) ?? 0;
    if (feeNum < 0) {
      setError("Fee amount cannot be negative.");
      setLoading(false);
      return;
    }

    const payload = {
      name,
      provider: provider || null,
      billing_cycle: billingCycle,
      amount: amountNum,
      currency_code: currency,
      fee_amount: feeNum,
      payment_method_type: paymentMethodType,
      credit_card_id: paymentMethodType === "credit_card" ? creditCardId || null : null,
      account_id: paymentMethodType === "account" ? accountId || null : null,
      category_id: categoryId || null,
      next_billing_date: nextBillingDate,
      auto_log_transaction: autoLog,
      status,
      notes: notes || null,
    };

    const { error: dbErr } = subscription
      ? await supabase.from("subscriptions").update(payload).eq("id", subscription.id)
      : await supabase.from("subscriptions").insert({ ...payload, user_id: user.id });

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sub-name">Name *</Label>
          <Input
            id="sub-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Netflix"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-provider">Provider</Label>
          <Input
            id="sub-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="e.g. Netflix, Inc."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Billing cycle *</Label>
          <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as Subscription["billing_cycle"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CYCLE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-next-billing">Next billing date *</Label>
          <Input
            id="sub-next-billing"
            type="date"
            required
            value={nextBillingDate}
            onChange={(e) => setNextBillingDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="sub-amount">Amount *</Label>
          <Input
            id="sub-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            required
            value={formatMoneyInputDisplay(amount)}
            onChange={(e) => setAmount(sanitizeMoneyInputNonNegative(e.target.value))}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Subscription price per billing cycle (before extra per-cycle fees).
          </p>
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

      <div className="space-y-2">
        <Label htmlFor="sub-fee">Fee amount</Label>
        <Input
          id="sub-fee"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="tabular-nums"
          value={formatMoneyInputDisplay(feeAmount)}
          onChange={(e) => setFeeAmount(sanitizeMoneyInputNonNegative(e.target.value))}
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">
          Optional extra charged each cycle (e.g. card foreign transaction or FX fees). Totals and
          reminders include amount + fee.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Payment method *</Label>
        <div className="flex gap-3">
          {(["credit_card", "account"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setPaymentMethodType(type)}
              className={cn(
                "flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                paymentMethodType === type
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-secondary"
              )}
            >
              {type === "credit_card" ? <CreditCard className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
              {type === "credit_card" ? "Credit card" : "Account"}
            </button>
          ))}
        </div>
      </div>

      {paymentMethodType === "credit_card" ? (
        <div className="space-y-2">
          <Label>Credit card</Label>
          <Select value={creditCardId} onValueChange={setCreditCardId}>
            <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
            <SelectContent>
              {creditCards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.last_four ? ` ···${c.last_four}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={categoryId || NO_CATEGORY_SELECT_VALUE}
          onValueChange={(v) =>
            setCategoryId(v === NO_CATEGORY_SELECT_VALUE ? "" : v)
          }
        >
          <SelectTrigger><SelectValue placeholder="No category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY_SELECT_VALUE}>No category</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as Subscription["status"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Auto-log transaction</p>
          <p className="text-xs text-muted-foreground">Automatically record when billed</p>
        </div>
        <Switch checked={autoLog} onCheckedChange={setAutoLog} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sub-notes">Notes</Label>
        <Textarea
          id="sub-notes"
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
        {loading ? "Saving…" : subscription ? "Update subscription" : "Add subscription"}
      </Button>
    </form>
  );
}

// ---- Subscription Row ----
function SubscriptionRow({
  sub,
  creditCards,
  accounts,
  onEdit,
}: {
  sub: Subscription;
  creditCards: CreditCard[];
  accounts: Account[];
  onEdit: (s: Subscription) => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const days = daysUntil(sub.next_billing_date);
  const card = creditCards.find((c) => c.id === sub.credit_card_id);
  const account = accounts.find((a) => a.id === sub.account_id);
  const paymentLabel = card
    ? `${card.name}${card.last_four ? ` ···${card.last_four}` : ""}`
    : account?.name ?? "—";

  const color = avatarColor(sub.provider ?? sub.name);
  const letter = (sub.provider ?? sub.name).charAt(0).toUpperCase();

  async function updateStatus(newStatus: Subscription["status"]) {
    setLoading(true);
    await supabase.from("subscriptions").update({ status: newStatus }).eq("id", sub.id);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-4 py-4 px-5 bg-card border border-border rounded-lg">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
        style={{ background: color }}
      >
        {letter}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-foreground">{sub.name}</p>
          <Badge variant="outline" className="text-xs capitalize">
            {CYCLE_LABELS[sub.billing_cycle]}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{paymentLabel}</span>
          {sub.fee_amount > 0 && (
            <span className="text-xs text-muted-foreground">
              + {formatCurrency(sub.fee_amount, displayCurrency)} fee
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="font-semibold text-sm text-foreground">
          {formatCurrency(sub.amount, displayCurrency)}
        </p>
        <p className="text-xs text-muted-foreground">
          {sub.next_billing_date ? (
            <>
              {formatDate(sub.next_billing_date)} ·{" "}
              <span className={cn(days < 0 ? "text-destructive" : days <= 7 ? "text-warning-700" : "")}>
                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`}
              </span>
            </>
          ) : "—"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => onEdit(sub)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {sub.status === "active" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-warning-700 hover:text-warning-700 hover:bg-warning/10"
              disabled={loading}
              onClick={() => updateStatus("paused")}
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={loading}
              onClick={() => updateStatus("cancelled")}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {sub.status === "paused" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-success hover:text-success hover:bg-success/10"
              disabled={loading}
              onClick={() => updateStatus("active")}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={loading}
              onClick={() => updateStatus("cancelled")}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {sub.status === "cancelled" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-success hover:text-success hover:bg-success/10"
            disabled={loading}
            onClick={() => updateStatus("active")}
          >
            <Play className="h-3.5 w-3.5" />
            Reactivate
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Main Page Client ----
interface Props {
  initialSubscriptions: Subscription[];
  creditCards: CreditCard[];
  accounts: Account[];
  categories: Category[];
}

export function SubscriptionsPageClient({
  initialSubscriptions,
  creditCards,
  accounts,
  categories,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | undefined>();
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{ transactions_created: number; processed: number } | null>(null);
  const router = useRouter();

  const active = initialSubscriptions.filter((s) => s.status === "active");
  const paused = initialSubscriptions.filter((s) => s.status === "paused");
  const cancelled = initialSubscriptions.filter((s) => s.status === "cancelled");

  const totalMonthly = active.reduce(
    (sum, s) => sum + toMonthly(s.amount + s.fee_amount, s.billing_cycle),
    0
  );

  const unusedCount = active.filter(isUnused).length;

  // Subscriptions due for auto-logging today or overdue
  const dueForProcessing = active.filter(
    (s) => s.auto_log_transaction && daysUntil(s.next_billing_date) <= 0
  );

  async function processDue() {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch("/api/subscriptions/process-due", { method: "POST" });
      const data = await res.json();
      setProcessResult({ transactions_created: data.transactions_created, processed: data.processed });
      router.refresh();
    } catch {
      setProcessResult({ transactions_created: 0, processed: 0 });
    } finally {
      setProcessing(false);
    }
  }

  function openNew() {
    setEditingSub(undefined);
    setSheetOpen(true);
  }

  function openEdit(sub: Subscription) {
    setEditingSub(sub);
    setSheetOpen(true);
  }

  function renderSection(subs: Subscription[], label: string) {
    if (subs.length === 0) return null;
    return (
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h2>
          <Badge variant="secondary">{subs.length}</Badge>
        </div>
        <div className="space-y-2">
          {subs.map((sub) => (
            <SubscriptionRow
              key={sub.id}
              sub={sub}
              creditCards={creditCards}
              accounts={accounts}
              onEdit={openEdit}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Monthly subscription spend</p>
          <p className="mt-0.5 text-2xl font-display font-bold text-foreground sm:text-3xl">
            {formatCurrency(totalMonthly, displayCurrency)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:shrink-0">
          {dueForProcessing.length > 0 && !processResult && (
            <Button
              variant="outline"
              onClick={processDue}
              disabled={processing}
              className="relative"
            >
              <RefreshCcw className={cn("h-4 w-4", processing && "animate-spin")} />
              {processing ? "Processing…" : `Log ${dueForProcessing.length} due`}
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                {dueForProcessing.length}
              </span>
            </Button>
          )}
          {processResult && (
            <div className="flex items-center gap-1.5 text-sm text-success-600 bg-success/10 border border-success/20 rounded-lg px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Logged <strong>{processResult.transactions_created}</strong> transaction{processResult.transactions_created !== 1 ? "s" : ""} for {processResult.processed} subscription{processResult.processed !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add subscription
          </Button>
        </div>
      </div>

      {/* Health alert */}
      {unusedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warning-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning-700">Subscription health check</p>
            <p className="text-sm text-warning-700/80 mt-0.5">
              {unusedCount} active subscription{unusedCount !== 1 ? "s" : ""} ha{unusedCount !== 1 ? "ve" : "s"} not
              been used in 60+ days. Consider pausing or cancelling.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="active">
            Active <span className="ml-1.5 text-xs opacity-70">({active.length})</span>
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused <span className="ml-1.5 text-xs opacity-70">({paused.length})</span>
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled <span className="ml-1.5 text-xs opacity-70">({cancelled.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {active.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No active subscriptions.</div>
          ) : (
            <div className="space-y-2">
              {active.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  creditCards={creditCards}
                  accounts={accounts}
                  onEdit={openEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="paused" className="mt-4">
          {paused.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No paused subscriptions.</div>
          ) : (
            <div className="space-y-2">
              {paused.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  creditCards={creditCards}
                  accounts={accounts}
                  onEdit={openEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="cancelled" className="mt-4">
          {cancelled.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No cancelled subscriptions.</div>
          ) : (
            <div className="space-y-2">
              {cancelled.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  creditCards={creditCards}
                  accounts={accounts}
                  onEdit={openEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingSub ? "Edit subscription" : "Add subscription"}</SheetTitle>
            <SheetDescription>
              {editingSub ? "Update subscription details." : "Track a new recurring subscription."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <SubscriptionForm
              subscription={editingSub}
              creditCards={creditCards}
              accounts={accounts}
              categories={categories}
              onSuccess={() => setSheetOpen(false)}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
