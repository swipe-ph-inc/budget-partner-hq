"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn, formatCurrency, formatPercent, utilColour } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/types/database";
import { currencySelectOptions } from "@/lib/currencies";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";

type CreditCardRow = Database["public"]["Tables"]["credit_cards"]["Row"];
type CardWithBalance = CreditCardRow & { outstanding_balance: number };

type NetworkType = "visa" | "mastercard" | "amex" | "jcb" | "other";

const NETWORK_EMOJIS: Record<NetworkType | "other", string> = {
  visa: "💳 Visa",
  mastercard: "💳 Mastercard",
  amex: "💳 Amex",
  jcb: "💳 JCB",
  other: "💳 Card",
};

const CARD_COLORS = [
  "#032e6d",
  "#1a1a2e",
  "#16213e",
  "#0f3460",
  "#533483",
  "#2c2c54",
  "#6b6350",
  "#28c095",
];

function UtilisationBar({ pct }: { pct: number }) {
  const colour = utilColour(pct);
  const barClass =
    colour === "green"
      ? "bg-success"
      : colour === "amber"
      ? "bg-warning"
      : "bg-destructive";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Utilisation</span>
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
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClass)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function isDueSoon(paymentDueDay: number | null): boolean {
  if (!paymentDueDay) return false;
  const today = new Date();
  const dueDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    paymentDueDay
  );
  if (dueDate < today) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }
  const diffDays = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= 7;
}

function isOverdue(paymentDueDay: number | null): boolean {
  if (!paymentDueDay) return false;
  const today = new Date();
  const dueDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    paymentDueDay
  );
  return dueDate < today && dueDate.getDate() === paymentDueDay;
}

function CardTile({
  card,
  onEdit,
}: {
  card: CardWithBalance;
  onEdit: (c: CardWithBalance) => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const utilisationPct =
    card.credit_limit > 0
      ? (card.outstanding_balance / card.credit_limit) * 100
      : 0;
  const dueSoon = isDueSoon(card.payment_due_day);
  const overdue = isOverdue(card.payment_due_day);

  return (
    <div
      className="relative rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all cursor-pointer"
      style={{ background: card.color ?? "#032e6d" }}
    >
      {/* Overdue badge */}
      {overdue && (
        <div className="absolute top-3 right-3 z-10">
          <Badge variant="destructive" className="text-xs">
            Overdue
          </Badge>
        </div>
      )}

      {/* Card face */}
      <div className="p-5 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs opacity-60 uppercase tracking-wider font-medium">
              Credit Card
            </p>
            <p className="font-display font-bold text-lg mt-0.5 leading-tight">
              {card.name}
            </p>
          </div>
          <p className="text-lg opacity-80">
            {NETWORK_EMOJIS[(card.network as NetworkType) ?? "other"]}
          </p>
        </div>

        <p className="font-mono text-sm tracking-widest opacity-80">
          ●●●● ●●●● ●●●● {card.last_four ?? "****"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs opacity-60">Outstanding</p>
            <p className="font-semibold text-sm mt-0.5">
              {formatCurrency(card.outstanding_balance, displayCurrency)}
            </p>
          </div>
          <div>
            <p className="text-xs opacity-60">Credit limit</p>
            <p className="font-semibold text-sm mt-0.5">
              {formatCurrency(card.credit_limit, displayCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* White info section */}
      <div className="bg-card px-5 pb-4 pt-3 space-y-3">
        <UtilisationBar pct={utilisationPct} />

        {dueSoon && !overdue && (
          <div className="flex items-center gap-1.5 text-xs text-warning-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Payment due in ≤7 days (day {card.payment_due_day})
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link
            href={`/credit-cards/${card.id}`}
            className="text-xs text-primary font-medium hover:underline"
          >
            View details →
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground touch-manipulation"
            aria-label={`Edit ${card.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Amount input helpers ─────────────────────────────────────────────────────
function toDisplayAmount(raw: string): string {
  // Strip everything except digits and one decimal point
  const clean = raw.replace(/[^0-9.]/g, "").replace(/^(\d*\.?\d*).*$/, "$1");
  const [integer, decimal] = clean.split(".");
  const formatted = (integer || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

function parseAmount(display: string): number {
  return parseFloat(display.replace(/,/g, "")) || 0;
}

function AmountInput({
  id,
  value,
  onChange,
  placeholder,
  required,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      required={required}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(toDisplayAmount(e.target.value))}
    />
  );
}

// ─── Card Form ────────────────────────────────────────────────────────────────
function CardForm({
  card,
  onSuccess,
  onClose,
  canAddCard,
  cardLimit,
}: {
  card?: CardWithBalance;
  onSuccess: () => void;
  onClose: () => void;
  canAddCard: boolean;
  cardLimit: number;
}) {
  const displayCurrency = useDisplayCurrency();
  const isNew = !card;

  const [name, setName] = useState(card?.name ?? "");
  const [lastFour, setLastFour] = useState(card?.last_four ?? "");
  const [network, setNetwork] = useState<NetworkType>(
    (card?.network as NetworkType) ?? "visa"
  );
  const [creditLimit, setCreditLimit] = useState(
    card?.credit_limit ? toDisplayAmount(card.credit_limit.toString()) : ""
  );
  const [currency, setCurrency] = useState(card?.currency_code ?? displayCurrency);
  const currencyOptions = useMemo(() => currencySelectOptions(currency), [currency]);
  const [billingCycleStartDay, setBillingCycleStartDay] = useState(
    card?.billing_cycle_start_day?.toString() ?? "1"
  );
  const [paymentDueDay, setPaymentDueDay] = useState(
    card?.payment_due_day?.toString() ?? "25"
  );
  const [minPaymentType, setMinPaymentType] = useState<"flat" | "percentage">(
    (card?.min_payment_type as "flat" | "percentage") ?? "percentage"
  );
  const [minPaymentValue, setMinPaymentValue] = useState(
    card?.min_payment_value ? toDisplayAmount(card.min_payment_value.toString()) : ""
  );
  const [openingBalance, setOpeningBalance] = useState("");
  const [color, setColor] = useState(card?.color ?? CARD_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!card) setCurrency(displayCurrency);
  }, [displayCurrency, card]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const payload = {
      name,
      last_four: lastFour || null,
      network,
      credit_limit: parseAmount(creditLimit),
      currency_code: currency,
      billing_cycle_start_day: parseInt(billingCycleStartDay),
      payment_due_day: parseInt(paymentDueDay),
      min_payment_type: minPaymentType,
      min_payment_value: minPaymentValue ? parseAmount(minPaymentValue) : null,
      color,
    };

    if (card) {
      const { error: dbError } = await supabase
        .from("credit_cards")
        .update(payload)
        .eq("id", card.id);
      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return;
      }
    } else {
      if (!canAddCard) {
        setError(`Free plan allows up to ${cardLimit} credit cards. Upgrade to Pro for more.`);
        setLoading(false);
        return;
      }
      const { data: newCard, error: dbError } = await supabase
        .from("credit_cards")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();
      if (dbError || !newCard) {
        setError(dbError?.message ?? "Failed to create card");
        setLoading(false);
        return;
      }

      // Seed opening balance as an initial credit_charge transaction
      const opening = parseAmount(openingBalance);
      if (opening > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const { error: txError } = await supabase.from("transactions").insert({
          user_id: user.id,
          type: "credit_charge",
          credit_card_id: newCard.id,
          amount: opening,
          currency_code: currency,
          date: today,
          description: "Opening balance",
        });
        if (txError) {
          setError(`Card created but opening balance failed: ${txError.message}`);
          setLoading(false);
          return;
        }
      }
    }

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isNew && !canAddCard && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-800">
          You&apos;ve reached the free plan limit of {cardLimit} credit cards. Upgrade to Pro in Profile to add more.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="cc-name">Card name *</Label>
        <Input
          id="cc-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. BPI Credit Card"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cc-last4">Last 4 digits</Label>
          <Input
            id="cc-last4"
            maxLength={4}
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ""))}
            placeholder="1234"
          />
        </div>
        <div className="space-y-2">
          <Label>Network</Label>
          <Select value={network} onValueChange={(v) => setNetwork(v as NetworkType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visa">Visa</SelectItem>
              <SelectItem value="mastercard">Mastercard</SelectItem>
              <SelectItem value="amex">Amex</SelectItem>
              <SelectItem value="jcb">JCB</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cc-limit">Credit limit *</Label>
          <AmountInput
            id="cc-limit"
            required
            value={creditLimit}
            onChange={setCreditLimit}
            placeholder="50,000"
          />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Opening balance — new cards only */}
      {isNew && (
        <div className="space-y-2">
          <Label htmlFor="cc-opening">
            Current outstanding balance
            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional — leave blank if zero)</span>
          </Label>
          <AmountInput
            id="cc-opening"
            value={openingBalance}
            onChange={setOpeningBalance}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            The balance you already owe on this card before logging transactions here.
          </p>
        </div>
      )}

      {/* Edit mode — show computed balance as read-only */}
      {!isNew && (
        <div className="rounded-lg bg-secondary/60 border border-border px-4 py-3 space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current outstanding balance</p>
          <p className="text-lg font-bold text-destructive">
            {formatCurrency(card.outstanding_balance, displayCurrency)}
          </p>
          <p className="text-xs text-muted-foreground">
            Computed from your transaction history. Log a payment to reduce it.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cc-billing-day">Billing cycle start day</Label>
          <Input
            id="cc-billing-day"
            type="number"
            min="1"
            max="28"
            value={billingCycleStartDay}
            onChange={(e) => setBillingCycleStartDay(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-due-day">Payment due day</Label>
          <Input
            id="cc-due-day"
            type="number"
            min="1"
            max="28"
            value={paymentDueDay}
            onChange={(e) => setPaymentDueDay(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Min payment type</Label>
          <Select
            value={minPaymentType}
            onValueChange={(v) => setMinPaymentType(v as "flat" | "percentage")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat amount</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-min-value">
            Min payment {minPaymentType === "percentage" ? "(%)" : `(${currency})`}
          </Label>
          <AmountInput
            id="cc-min-value"
            value={minPaymentValue}
            onChange={setMinPaymentValue}
            placeholder={minPaymentType === "percentage" ? "5" : "500"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Card colour</Label>
        <div className="flex gap-2 flex-wrap">
          {CARD_COLORS.map((c) => (
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

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading || (isNew && !canAddCard)} className="flex-1">
          {loading ? "Saving…" : card ? "Update card" : "Add card"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main Client Component ─────────────────────────────────────────────────────
interface Props {
  initialCards: CardWithBalance[];
  isPro: boolean;
  canAddCard: boolean;
  cardLimit: number;
}

export function CreditCardsPageClient({
  initialCards,
  isPro,
  canAddCard,
  cardLimit,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardWithBalance | undefined>();

  function openNew() {
    setEditingCard(undefined);
    setSheetOpen(true);
  }

  function openEdit(card: CardWithBalance) {
    setEditingCard(card);
    setSheetOpen(true);
  }

  const totalLimit = initialCards.reduce((s, c) => s + c.credit_limit, 0);
  const totalOutstanding = initialCards.reduce(
    (s, c) => s + c.outstanding_balance,
    0
  );
  const aggregateUtil =
    totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold text-foreground sm:text-2xl">
            Credit Cards
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {initialCards.length} card{initialCards.length !== 1 ? "s" : ""} ·{" "}
            {formatPercent(aggregateUtil)} aggregate utilisation
          </p>
        </div>
        <Button
          onClick={openNew}
          className="w-full shrink-0 sm:w-auto"
          disabled={!canAddCard}
          title={!canAddCard ? `Free plan: max ${cardLimit} cards` : undefined}
        >
          <Plus className="h-4 w-4" />
          Add card
        </Button>
      </div>
      {!isPro && (
        <p className="text-xs text-muted-foreground sm:text-right">
          Free plan: up to {cardLimit} credit cards
          {!canAddCard && " — limit reached"}
        </p>
      )}

      {/* Summary */}
      {initialCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Total Outstanding
            </p>
            <p className="text-2xl font-display font-bold text-destructive mt-1">
              {formatCurrency(totalOutstanding, displayCurrency)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Total Credit Limit
            </p>
            <p className="text-2xl font-display font-bold text-foreground mt-1">
              {formatCurrency(totalLimit, displayCurrency)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">
              Aggregate Utilisation
            </p>
            <UtilisationBar pct={aggregateUtil} />
          </div>
        </div>
      )}

      {/* Card grid */}
      {initialCards.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No credit cards yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your credit cards to track balances, utilisation, and due dates.
            </p>
          </div>
          <Button onClick={openNew} disabled={!canAddCard}>
            <Plus className="h-4 w-4" />
            Add your first card
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {initialCards.map((card) => (
            <CardTile key={card.id} card={card} onEdit={openEdit} />
          ))}
        </div>
      )}

      {/* Card Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingCard ? "Edit card" : "Add credit card"}</SheetTitle>
            <SheetDescription>
              {editingCard
                ? "Update your credit card details."
                : "Add a new credit card to track."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CardForm
              key={editingCard?.id ?? "new"}
              card={editingCard}
              onSuccess={() => setSheetOpen(false)}
              onClose={() => setSheetOpen(false)}
              canAddCard={canAddCard || !!editingCard}
              cardLimit={cardLimit}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Re-export UtilisationBar for use in detail page
export { UtilisationBar };
