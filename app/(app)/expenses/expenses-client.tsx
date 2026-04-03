"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Receipt,
  Calendar,
  Tag,
  RefreshCw,
  X,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type Expense = Database["public"]["Tables"]["expenses"]["Row"] & {
  categories: { id: string; name: string; color: string | null } | null;
  merchants: { id: string; name: string } | null;
  /** Row from standalone `expenses` table vs mapped from `transactions`. */
  source?: "ledger" | "transaction";
  /** When source is transaction: expense vs credit_charge. */
  txType?: string;
};

type Category = { id: string; name: string; color: string | null };
type Merchant = { id: string; name: string };
type Account = { id: string; name: string; currency_code: string };
type CreditCard = { id: string; name: string; last_four: string | null; currency_code: string };

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"];
const RECURRENCE_RULES = ["daily", "weekly", "monthly"] as const;

// ─── Add Expense Form ─────────────────────────────────────────────────────────
function ExpenseForm({
  categories,
  merchants,
  accounts,
  creditCards,
  onSuccess,
  onClose,
}: {
  categories: Category[];
  merchants: Merchant[];
  accounts: Account[];
  creditCards: CreditCard[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [categoryId, setCategoryId] = useState("__none__");
  const [merchantSearch, setMerchantSearch] = useState("");
  const [merchantId, setMerchantId] = useState("__none__");
  const [paymentMethod, setPaymentMethod] = useState<"account" | "credit_card">("account");
  const [accountId, setAccountId] = useState("__none__");
  const [creditCardId, setCreditCardId] = useState("__none__");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch.trim()) return merchants.slice(0, 10);
    const q = merchantSearch.toLowerCase();
    return merchants.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [merchants, merchantSearch]);

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

    const tagArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Database["public"]["Tables"]["expenses"]["Insert"] = {
      user_id: user.id,
      date,
      amount: parseFloat(amount),
      currency_code: currency,
      category_id: categoryId !== "__none__" ? categoryId : null,
      merchant_id: merchantId !== "__none__" ? merchantId : null,
      account_id:
        paymentMethod === "account" && accountId !== "__none__"
          ? accountId
          : null,
      credit_card_id:
        paymentMethod === "credit_card" && creditCardId !== "__none__"
          ? creditCardId
          : null,
      description: description || null,
      tags: tagArray.length > 0 ? tagArray : null,
      receipt_url: receiptUrl || null,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? recurrenceRule : null,
    };

    const { error: dbError } = await supabase.from("expenses").insert(payload);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date + amount */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="exp-date">Date *</Label>
          <Input
            id="exp-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-amount">Amount *</Label>
          <Input
            id="exp-amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No category</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Merchant fuzzy search */}
      <div className="space-y-2">
        <Label>Merchant</Label>
        <Input
          placeholder="Search merchant…"
          value={merchantSearch}
          onChange={(e) => {
            setMerchantSearch(e.target.value);
            setMerchantId("__none__");
          }}
        />
        {merchantSearch && (
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden max-h-40 overflow-y-auto">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary text-muted-foreground"
              onClick={() => {
                setMerchantId("__none__");
                setMerchantSearch("");
              }}
            >
              No merchant
            </button>
            {filteredMerchants.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-secondary",
                  merchantId === m.id && "bg-secondary font-medium"
                )}
                onClick={() => {
                  setMerchantId(m.id);
                  setMerchantSearch(m.name);
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Payment method toggle */}
      <div className="space-y-2">
        <Label>Payment method</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod("account")}
            className={cn(
              "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
              paymentMethod === "account"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:bg-secondary"
            )}
          >
            Bank / E-wallet
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("credit_card")}
            className={cn(
              "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
              paymentMethod === "credit_card"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:bg-secondary"
            )}
          >
            Credit card
          </button>
        </div>
      </div>

      {paymentMethod === "account" && (
        <div className="space-y-2">
          <Label>Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No account</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.currency_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {paymentMethod === "credit_card" && (
        <div className="space-y-2">
          <Label>Credit card</Label>
          <Select value={creditCardId} onValueChange={setCreditCardId}>
            <SelectTrigger>
              <SelectValue placeholder="Select card" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No card</SelectItem>
              {creditCards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.last_four ? ` ···· ${c.last_four}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="exp-desc">Description</Label>
        <Input
          id="exp-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this for?"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="exp-tags">Tags (comma-separated)</Label>
        <Input
          id="exp-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. work, reimbursable"
        />
      </div>

      {/* Receipt upload placeholder */}
      <div className="space-y-2">
        <Label htmlFor="exp-receipt">Receipt URL</Label>
        <div className="flex gap-2">
          <Input
            id="exp-receipt"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            placeholder="Upload receipt (paste URL)"
          />
          {!receiptUrl && (
            <Button type="button" variant="outline" size="icon" disabled>
              <Receipt className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Paste a receipt image URL or upload to your storage.
        </p>
      </div>

      {/* Recurring */}
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-primary" />
              Recurring expense
            </p>
            <p className="text-xs text-muted-foreground">
              This expense repeats on a schedule
            </p>
          </div>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>

        {isRecurring && (
          <div className="space-y-2 pl-2">
            <Label>Recurrence pattern</Label>
            <Select
              value={recurrenceRule}
              onValueChange={(v) => setRecurrenceRule(v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving…" : "Add expense"}
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
  initialExpenses: Expense[];
  categories: Category[];
  merchants: Merchant[];
  accounts: Account[];
  creditCards: CreditCard[];
  isPro: boolean;
  freeHistoryMinDate?: string;
}

export function ExpensesPageClient({
  initialExpenses,
  categories,
  merchants,
  accounts,
  creditCards,
  isPro,
  freeHistoryMinDate,
}: Props) {
  const router = useRouter();

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [merchantFilter, setMerchantFilter] = useState("__all__");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    return initialExpenses.filter((exp) => {
      if (dateFrom && exp.date < dateFrom) return false;
      if (dateTo && exp.date > dateTo) return false;
      if (categoryFilter !== "__all__" && exp.category_id !== categoryFilter) return false;
      if (merchantFilter !== "__all__" && exp.merchant_id !== merchantFilter) return false;
      if (amountMin && exp.amount < parseFloat(amountMin)) return false;
      if (amountMax && exp.amount > parseFloat(amountMax)) return false;
      if (tagsFilter.trim()) {
        const q = tagsFilter.toLowerCase();
        const hasTags = exp.tags?.some((t) => t.toLowerCase().includes(q));
        if (!hasTags) return false;
      }
      return true;
    });
  }, [initialExpenses, dateFrom, dateTo, categoryFilter, merchantFilter, amountMin, amountMax, tagsFilter]);

  const runningTotal = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amount, 0),
    [filtered]
  );

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; expenses: Expense[] }[] = [];
    const dateMap: Record<string, Expense[]> = {};

    filtered.forEach((exp) => {
      if (!dateMap[exp.date]) {
        dateMap[exp.date] = [];
        groups.push({ date: exp.date, expenses: dateMap[exp.date] });
      }
      dateMap[exp.date].push(exp);
    });

    return groups;
  }, [filtered]);

  const hasFilters =
    dateFrom || dateTo || categoryFilter !== "__all__" || merchantFilter !== "__all__" || amountMin || amountMax || tagsFilter;

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setCategoryFilter("__all__");
    setMerchantFilter("__all__");
    setAmountMin("");
    setAmountMax("");
    setTagsFilter("");
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Expenses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} records ·{" "}
            <span className="font-semibold text-destructive">
              {formatCurrency(runningTotal, "PHP")}
            </span>{" "}
            total
            {!isPro && freeHistoryMinDate && (
              <span className="block sm:inline sm:before:content-['·_'] sm:before:mr-1">
                Free plan: history from {formatDate(freeHistoryMinDate, "MMM d, yyyy")} onward
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Shows spending from{" "}
            <span className="font-medium text-foreground">Transactions</span> (expenses and card
            charges) together with entries you add only here.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={merchantFilter} onValueChange={setMerchantFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All merchants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All merchants</SelectItem>
              {merchants.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="0"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              className="w-28"
              placeholder="Min amount"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="number"
              min="0"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              className="w-28"
              placeholder="Max amount"
            />
          </div>

          <Input
            className="flex-1 min-w-[160px]"
            placeholder="Filter by tag…"
            value={tagsFilter}
            onChange={(e) => setTagsFilter(e.target.value)}
          />

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Expense list grouped by date */}
      {groupedByDate.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <Receipt className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">No expenses found</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {hasFilters
              ? "Try adjusting your filters."
              : "Log spending under Transactions (expenses or card charges), or use the + button to add a standalone expense entry here."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(({ date, expenses: dayExpenses }) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">
                    {formatDate(date, "EEEE, MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-semibold text-destructive">
                  {formatCurrency(
                    dayExpenses.reduce((s, e) => s + e.amount, 0),
                    dayExpenses[0]?.currency_code ?? "PHP"
                  )}
                </span>
              </div>

              {/* Expense cards */}
              <div className="space-y-2">
                {dayExpenses.map((exp) => (
                  <div
                    key={`${exp.source ?? "ledger"}-${exp.id}`}
                    className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-all"
                  >
                    {/* Category colour bar */}
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{
                        background: exp.categories?.color ?? "#6b7280",
                      }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground truncate">
                          {exp.merchants?.name ??
                            exp.description ??
                            "Expense"}
                        </p>
                        {exp.categories && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full border"
                            style={{
                              background: `${exp.categories.color ?? "#6b7280"}15`,
                              borderColor: `${exp.categories.color ?? "#6b7280"}30`,
                              color: exp.categories.color ?? "#6b7280",
                            }}
                          >
                            {exp.categories.name}
                          </span>
                        )}
                        {exp.source === "transaction" && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {exp.txType === "credit_charge" ? "Card charge" : "Transactions"}
                          </Badge>
                        )}
                        {exp.is_recurring && (
                          <Badge variant="secondary" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {exp.recurrence_rule ?? "recurring"}
                          </Badge>
                        )}
                        {exp.receipt_url && (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="View receipt"
                          >
                            <Receipt className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      {exp.description && exp.merchants?.name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {exp.description}
                        </p>
                      )}
                      {exp.tags && exp.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {exp.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 text-xs bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="font-mono font-semibold text-sm text-destructive tabular-nums">
                        -{formatCurrency(exp.amount, exp.currency_code)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Add Button */}
      <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        <Button
          size="lg"
          className="rounded-full shadow-float h-14 w-14 p-0"
          onClick={() => setSheetOpen(true)}
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Add expense</span>
        </Button>
      </div>

      {/* Add Expense Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add expense</SheetTitle>
            <SheetDescription>
              Log a new expense with category, merchant, and payment method.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ExpenseForm
              categories={categories}
              merchants={merchants}
              accounts={accounts}
              creditCards={creditCards}
              onSuccess={() => setSheetOpen(false)}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
