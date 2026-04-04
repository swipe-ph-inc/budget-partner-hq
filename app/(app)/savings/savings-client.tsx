"use client";

import React, { useState } from "react";
import {
  Plus,
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import {
  sanitizeMoneyInputNonNegative,
  formatMoneyInputDisplay,
  parseMoneyInput,
} from "@/lib/money-input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type SavingsPlan = Database["public"]["Tables"]["savings_plans"]["Row"];
type SavingsContribution = Database["public"]["Tables"]["savings_contributions"]["Row"];
type Account = Pick<Database["public"]["Tables"]["accounts"]["Row"], "id" | "name" | "currency_code">;

const PLAN_COLORS = [
  "#032e6d", "#28c095", "#cea843", "#ef4444",
  "#8b5cf6", "#f97316", "#06b6d4", "#ec4899",
];

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"];

/** Radix Select forbids SelectItem value="". */
const NO_LINKED_ACCOUNT_VALUE = "__none__";

// ---- Status calculation ----
function getPlanStatus(plan: SavingsPlan, contributions: SavingsContribution[]) {
  if (plan.current_amount >= plan.target_amount) return "Achieved";

  const planContribs = contributions.filter((c) => c.savings_plan_id === plan.id);

  if (!plan.target_date) return "On Track";

  if (planContribs.length === 0) return "Behind";

  // Calculate avg monthly contribution
  const sorted = [...planContribs].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = new Date(sorted[0].date);
  const lastDate = new Date(sorted[sorted.length - 1].date);
  const monthsElapsed = Math.max(
    1,
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
      (lastDate.getMonth() - firstDate.getMonth()) + 1
  );
  const totalContributed = planContribs.reduce((s, c) => s + c.amount, 0);
  const avgMonthly = totalContributed / monthsElapsed;

  if (avgMonthly <= 0) return "Behind";

  const remaining = plan.target_amount - plan.current_amount;
  const monthsNeeded = remaining / avgMonthly;
  const projectedDate = new Date();
  projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(monthsNeeded));

  const targetDate = new Date(plan.target_date);
  return projectedDate <= targetDate ? "On Track" : "Behind";
}

function getProjectedDate(plan: SavingsPlan, contributions: SavingsContribution[]): Date | null {
  const planContribs = contributions.filter((c) => c.savings_plan_id === plan.id);
  if (planContribs.length === 0) return null;

  const sorted = [...planContribs].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = new Date(sorted[0].date);
  const lastDate = new Date(sorted[sorted.length - 1].date);
  const monthsElapsed = Math.max(
    1,
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
      (lastDate.getMonth() - firstDate.getMonth()) + 1
  );
  const totalContributed = planContribs.reduce((s, c) => s + c.amount, 0);
  const avgMonthly = totalContributed / monthsElapsed;

  if (avgMonthly <= 0) return null;

  const remaining = plan.current_amount >= plan.target_amount ? 0 : plan.target_amount - plan.current_amount;
  if (remaining === 0) return new Date();

  const monthsNeeded = remaining / avgMonthly;
  const projected = new Date();
  projected.setMonth(projected.getMonth() + Math.ceil(monthsNeeded));
  return projected;
}

// ---- Circular Progress Ring ----
function CircularProgress({
  percentage,
  color,
  size = 80,
}: {
  percentage: number;
  color: string;
  size?: number;
}) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const dashoffset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e8e0cc"
        strokeWidth={8}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

// ---- Add Contribution Form ----
function ContributionForm({
  plan,
  onSuccess,
  onClose,
}: {
  plan: SavingsPlan;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    const newBalance = plan.current_amount + amt;

    const { error: insertErr } = await supabase
      .from("savings_contributions")
      .insert({
        savings_plan_id: plan.id,
        amount: amt,
        date,
        notes: notes || null,
      });

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    // Update plan current_amount
    await supabase
      .from("savings_plans")
      .update({
        current_amount: newBalance,
        is_achieved: newBalance >= plan.target_amount,
      })
      .eq("id", plan.id);

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-secondary rounded-lg border border-border mt-3">
      <p className="text-sm font-semibold text-foreground">Add contribution to {plan.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`amt-${plan.id}`} className="text-xs">Amount ({plan.currency_code})</Label>
          <Input
            id={`amt-${plan.id}`}
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`date-${plan.id}`} className="text-xs">Date</Label>
          <Input
            id={`date-${plan.id}`}
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${plan.id}`} className="text-xs">Notes (optional)</Label>
        <Input
          id={`notes-${plan.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Monthly deposit"
        />
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading} className="flex-1">
          {loading ? "Saving…" : "Add contribution"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- Plan Card ----
function PlanCard({
  plan,
  contributions,
  accounts,
}: {
  plan: SavingsPlan;
  contributions: SavingsContribution[];
  accounts: Account[];
}) {
  const displayCurrency = useDisplayCurrency();
  const [showContrib, setShowContrib] = useState(false);
  const [showContribForm, setShowContribForm] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const planContribs = contributions
    .filter((c) => c.savings_plan_id === plan.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const percentage = plan.target_amount > 0
    ? Math.min(100, (plan.current_amount / plan.target_amount) * 100)
    : 0;

  const status = getPlanStatus(plan, contributions);
  const projectedDate = getProjectedDate(plan, contributions);
  const linkedAccount = accounts.find((a) => a.id === plan.linked_account_id);
  const planColor = plan.color ?? "#032e6d";

  async function handleMarkAchieved() {
    await supabase
      .from("savings_plans")
      .update({ is_achieved: true })
      .eq("id", plan.id);
    router.refresh();
  }

  return (
    <div className="bg-card rounded-lg shadow-card border border-border overflow-hidden">
      {/* Color accent bar */}
      <div className="h-1.5 w-full" style={{ background: planColor }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {plan.icon && (
              <span className="text-2xl leading-none">{plan.icon}</span>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{plan.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target: {formatCurrency(plan.target_amount, displayCurrency)}
              </p>
            </div>
          </div>
          <Badge
            variant={
              status === "Achieved"
                ? "success"
                : status === "On Track"
                ? "accent"
                : "warning"
            }
            className="shrink-0"
          >
            {status}
          </Badge>
        </div>

        {/* Progress ring + amounts */}
        <div className="flex items-center gap-5 mt-5">
          <div className="relative shrink-0">
            <CircularProgress percentage={percentage} color={planColor} size={80} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-foreground">
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-display font-bold text-foreground">
              {formatCurrency(plan.current_amount, displayCurrency)}
            </p>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(plan.target_amount, displayCurrency)}
            </p>
            <div className="mt-2 space-y-1">
              {projectedDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 shrink-0" />
                  <span>Est. completion: {formatDate(projectedDate)}</span>
                </div>
              )}
              {plan.target_date && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>Target: {formatDate(plan.target_date)}</span>
                </div>
              )}
              {linkedAccount && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3 w-3 shrink-0" />
                  <span>{linkedAccount.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setShowContribForm((v) => !v);
              setShowContrib(false);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add contribution
          </Button>
          {plan.current_amount >= plan.target_amount && (
            <Button size="sm" variant="default" onClick={handleMarkAchieved}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark achieved
            </Button>
          )}
        </div>

        {/* Inline contribution form */}
        {showContribForm && (
          <ContributionForm
            plan={plan}
            onSuccess={() => setShowContribForm(false)}
            onClose={() => setShowContribForm(false)}
          />
        )}

        {/* Contribution history toggle */}
        {planContribs.length > 0 && (
          <>
            <Separator className="mt-4" />
            <button
              onClick={() => setShowContrib((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full mt-3"
            >
              {showContrib ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {planContribs.length} contribution{planContribs.length !== 1 ? "s" : ""}
            </button>
            {showContrib && (
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                {planContribs.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-secondary"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        {formatCurrency(c.amount, displayCurrency)}
                      </span>
                      {c.notes && (
                        <span className="text-muted-foreground ml-1.5">· {c.notes}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">{formatDate(c.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Add Plan Sheet Form ----
function AddPlanForm({
  accounts,
  onSuccess,
  onClose,
}: {
  accounts: Account[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currency, setCurrency] = useState(displayCurrency);
  const [targetDate, setTargetDate] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState<string>("");
  const [color, setColor] = useState(PLAN_COLORS[0]);
  const [icon, setIcon] = useState("");
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

    const amt = parseMoneyInput(targetAmount);
    if (amt === null || amt <= 0) {
      setError("Enter a valid target amount");
      setLoading(false);
      return;
    }

    const { error: dbErr } = await supabase.from("savings_plans").insert({
      user_id: user.id,
      name,
      target_amount: amt,
      currency_code: currency,
      target_date: targetDate || null,
      linked_account_id: linkedAccountId || null,
      color,
      icon: icon || null,
      current_amount: 0,
      is_achieved: false,
    });

    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  const EMOJI_OPTIONS = ["🎯", "🏠", "✈️", "🚗", "💍", "📚", "💻", "🌴", "💰", "🏖️", "🛒", "🎓"];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="plan-name">Goal name *</Label>
        <Input
          id="plan-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency Fund"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="plan-target">Target amount *</Label>
          <Input
            id="plan-target"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            required
            value={formatMoneyInputDisplay(targetAmount)}
            onChange={(e) => setTargetAmount(sanitizeMoneyInputNonNegative(e.target.value))}
            placeholder="0"
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

      <div className="space-y-2">
        <Label htmlFor="plan-target-date">Target date (optional)</Label>
        <Input
          id="plan-target-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Linked account (optional)</Label>
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
        <Label>Icon (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setIcon(icon === e ? "" : e)}
              className={cn(
                "w-9 h-9 text-lg rounded-lg border transition-all",
                icon === e
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-secondary"
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Colour</Label>
        <div className="flex gap-2 flex-wrap">
          {PLAN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all",
                color === c ? "border-foreground scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating…" : "Create savings goal"}
      </Button>
    </form>
  );
}

// ---- Main Page Client ----
interface Props {
  initialPlans: SavingsPlan[];
  accounts: Account[];
  initialContributions: SavingsContribution[];
}

export function SavingsPageClient({
  initialPlans,
  accounts,
  initialContributions,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalSaved = initialPlans.reduce((sum, p) => sum + p.current_amount, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Total saved across all goals</p>
          <p className="mt-0.5 text-2xl font-display font-bold text-foreground sm:text-3xl">
            {formatCurrency(totalSaved, displayCurrency)}
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="w-full shrink-0 sm:w-auto">
          <Plus className="h-4 w-4" />
          Add goal
        </Button>
      </div>

      {/* Plans grid */}
      {initialPlans.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No savings goals yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a goal and start tracking your progress toward it.
            </p>
          </div>
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4" />
            Create your first goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {initialPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              contributions={initialContributions}
              accounts={accounts}
            />
          ))}
        </div>
      )}

      {/* Add goal sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New savings goal</SheetTitle>
            <SheetDescription>
              Set a target and track your progress toward it.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <AddPlanForm
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
