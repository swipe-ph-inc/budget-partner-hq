"use client";

import React, { useState, useMemo, useTransition, useEffect } from "react";
import {
  Plus,
  Download,
  ChevronDown,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react";
import { ReceiptScanner, type ParsedReceipt } from "@/components/receipts/receipt-scanner";
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
import {
  cn,
  formatCurrency,
  formatDate,
  TX_TYPE_LABELS,
  TX_TYPE_COLORS,
  sortByLocaleName,
} from "@/lib/utils";
import {
  sanitizeMoneyInput,
  sanitizeMoneyInputNonNegative,
  formatMoneyInputDisplay,
  parseMoneyInput,
} from "@/lib/money-input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import Papa from "papaparse";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import { buildSafeReceiptApply } from "@/lib/receipt-autofill";
import { CreateMerchantInline } from "@/components/merchants/create-merchant-inline";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  accounts: { name: string; currency_code: string } | null;
  categories: { name: string; color: string | null } | null;
  merchants: { name: string } | null;
};

type Account = { id: string; name: string; currency_code: string; type: string };
type Category = { id: string; name: string; color: string | null; type: string };
type Merchant = { id: string; name: string };
type CreditCard = { id: string; name: string; last_four: string | null; currency_code: string };

export type TxType = "income" | "expense" | "transfer" | "credit_payment" | "credit_charge";

const TX_TYPES: { value: TxType; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
  { value: "credit_payment", label: "Card Payment" },
  { value: "credit_charge", label: "Card Charge" },
];

const INCOME_TYPES = ["salary", "freelance", "other"] as const;
const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"];

export function TypeBadge({ type }: { type: string }) {
  const colors = TX_TYPE_COLORS[type] ?? TX_TYPE_COLORS.expense;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {TX_TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function AmountDisplay({
  tx,
}: {
  tx: Transaction;
}) {
  const displayCurrency = useDisplayCurrency();
  const colorClass =
    tx.type === "income"
      ? "text-success"
      : tx.type === "expense"
      ? "text-destructive"
      : tx.type === "transfer"
      ? "text-primary"
      : tx.type === "credit_charge"
      ? "text-warning-700"
      : "text-accent-foreground";

  return (
    <span className={cn("font-mono font-semibold text-sm tabular-nums", colorClass)}>
      {tx.type === "income" ? "+" : tx.type === "expense" || tx.type === "credit_charge" ? "-" : ""}
      {formatCurrency(tx.amount, displayCurrency)}
      {tx.fee_amount > 0 && (
        <span className="text-xs text-muted-foreground ml-1">(+fee)</span>
      )}
    </span>
  );
}

// ─── Add Transaction Form ─────────────────────────────────────────────────────
export function TransactionForm({
  accounts,
  categories,
  merchants,
  creditCards,
  onSuccess,
  onClose,
  contextAccountId,
  defaultCurrency,
  initialType,
}: {
  accounts: Account[];
  categories: Category[];
  merchants: Merchant[];
  creditCards: CreditCard[];
  onSuccess: () => void;
  onClose: () => void;
  /** When set, pre-fills the relevant account field(s) for this account. */
  contextAccountId?: string | null;
  defaultCurrency?: string;
  initialType?: TxType;
}) {
  const displayCurrency = useDisplayCurrency();
  const [type, setType] = useState<TxType>(initialType ?? "expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [currency, setCurrency] = useState(defaultCurrency ?? displayCurrency);
  const [incomeType, setIncomeType] = useState<"salary" | "freelance" | "other">("salary");
  const [isCollected, setIsCollected] = useState(true);
  const [fromAccountId, setFromAccountId] = useState("__none__");
  const [toAccountId, setToAccountId] = useState("__none__");
  const [creditCardId, setCreditCardId] = useState("__none__");
  const [categoryId, setCategoryId] = useState("__none__");
  const [merchantSearch, setMerchantSearch] = useState("");
  const [merchantId, setMerchantId] = useState("__none__");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (defaultCurrency) setCurrency(defaultCurrency);
    else setCurrency(displayCurrency);
  }, [defaultCurrency, displayCurrency]);

  useEffect(() => {
    if (!contextAccountId) return;
    if (type === "income") {
      setToAccountId(contextAccountId);
      setFromAccountId("__none__");
    } else if (type === "expense" || type === "credit_payment") {
      setFromAccountId(contextAccountId);
    } else if (type === "transfer") {
      setFromAccountId(contextAccountId);
      setToAccountId((prev) => (prev === contextAccountId ? "__none__" : prev));
    } else if (type === "credit_charge") {
      setFromAccountId("__none__");
      setToAccountId("__none__");
    }
  }, [contextAccountId, type]);

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch.trim()) return merchants.slice(0, 10);
    const q = merchantSearch.toLowerCase();
    return merchants.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [merchants, merchantSearch]);

  const needsFromAccount = ["expense", "transfer", "credit_payment"].includes(type);
  const needsToAccount = type === "transfer";
  const needsCreditCard = ["credit_charge", "credit_payment"].includes(type);
  const needsIncomeType = type === "income";

  /** On account detail, from/to is always this account — hide redundant pickers. */
  const showFromAccountPicker = needsFromAccount && !contextAccountId;
  const showIncomeDepositPicker = type === "income" && !contextAccountId;

  function handleReceiptParsed(parsed: ParsedReceipt, url: string | null) {
    const apply = buildSafeReceiptApply(parsed, {
      merchants,
      categories,
      allowedCurrencies: SUPPORTED_CURRENCY_CODES,
    });

    if (apply.txType === "credit_charge") setType("credit_charge");
    else setType("expense");

    if (apply.amountStr) {
      setAmount(formatMoneyInputDisplay(sanitizeMoneyInput(apply.amountStr)));
    }
    if (apply.date) setDate(apply.date);
    if (apply.currency) setCurrency(apply.currency);
    if (apply.description) setDescription(apply.description);
    if (apply.feeStr) {
      setFeeAmount(formatMoneyInputDisplay(sanitizeMoneyInput(apply.feeStr)));
    }
    if (url) setAttachmentUrl(url);

    if (apply.merchantId) {
      setMerchantId(apply.merchantId);
      setMerchantSearch(apply.merchantSearch);
    } else {
      setMerchantId("__none__");
      setMerchantSearch(apply.merchantSearch);
    }

    if (apply.categoryId) setCategoryId(apply.categoryId);
  }

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

    const tagArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const amtParsed = parseMoneyInput(amount);
    if (amtParsed === null || amtParsed <= 0) {
      setError("Enter a valid amount greater than zero.");
      setLoading(false);
      return;
    }

    const feeParsed = parseMoneyInput(feeAmount);
    if (feeParsed === null || feeParsed < 0) {
      setError("Enter a valid fee amount (zero or more).");
      setLoading(false);
      return;
    }

    const payload: Database["public"]["Tables"]["transactions"]["Insert"] = {
      user_id: user.id,
      type,
      date,
      amount: amtParsed,
      currency_code: currency,
      income_type: needsIncomeType ? incomeType : null,
      is_collected: needsIncomeType ? isCollected : true,
      from_account_id: needsFromAccount && fromAccountId !== "__none__" ? fromAccountId : null,
      to_account_id:
        (needsToAccount || type === "income") && toAccountId !== "__none__" ? toAccountId : null,
      credit_card_id: needsCreditCard && creditCardId !== "__none__" ? creditCardId : null,
      category_id: categoryId !== "__none__" ? categoryId : null,
      merchant_id: merchantId !== "__none__" ? merchantId : null,
      description: description || null,
      tags: tagArray.length > 0 ? tagArray : null,
      fee_amount: feeParsed,
      attachment_url: attachmentUrl || null,
    };

    const { error: dbError } = await supabase.from("transactions").insert(payload);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pb-4">
      {/* Receipt scanner */}
      <ReceiptScanner onParsed={handleReceiptParsed} />

      {/* Type */}
      <div className="space-y-2">
        <Label>Transaction type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {TX_TYPES.map((t) => {
            const colors = TX_TYPE_COLORS[t.value];
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left",
                  type === t.value
                    ? cn("border-primary bg-primary/5 text-primary")
                    : "border-border hover:bg-secondary"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {type === "transfer" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowRightLeft className="h-3 w-3" />
            Creates two linked transactions
          </p>
        )}
      </div>

      {/* Amount + currency */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-2">
          <Label htmlFor="tx-amount">Amount *</Label>
          <Input
            id="tx-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            value={formatMoneyInputDisplay(amount)}
            onChange={(e) => setAmount(sanitizeMoneyInput(e.target.value))}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="tx-date">Date *</Label>
        <Input
          id="tx-date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Income type */}
      {needsIncomeType && (
        <>
          <div className="space-y-2">
            <Label>Income type *</Label>
            <Select value={incomeType} onValueChange={(v) => setIncomeType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salary">Salary</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Collected</p>
              <p className="text-xs text-muted-foreground">Uncheck if payment not yet received</p>
            </div>
            <Switch checked={isCollected} onCheckedChange={setIsCollected} />
          </div>
        </>
      )}

      {/* From account (hidden on account detail — always the current account) */}
      {showFromAccountPicker && (
        <div className="space-y-2">
          <Label>
            {type === "transfer" ? "From account" : "Account / Source"}
          </Label>
          <Select value={fromAccountId} onValueChange={setFromAccountId}>
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

      {/* To account */}
      {needsToAccount && (
        <div className="space-y-2">
          <Label>To account</Label>
          <Select value={toAccountId} onValueChange={setToAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No account</SelectItem>
              {accounts
                .filter((a) => a.id !== fromAccountId)
                .map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.currency_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Credit card */}
      {needsCreditCard && (
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

      {/* Income: deposit target (hidden on account detail — always this account) */}
      {showIncomeDepositPicker && (
        <div className="space-y-2">
          <Label>Deposit to account</Label>
          <Select value={toAccountId} onValueChange={setToAccountId}>
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

      {/* Merchant with fuzzy search */}
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
              onClick={() => { setMerchantId("__none__"); setMerchantSearch(""); }}
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
        <CreateMerchantInline
          merchantSearch={merchantSearch}
          merchantId={merchantId}
          categoryId={categoryId}
          merchants={merchants}
          categories={categories}
          onCreated={(m) => {
            setMerchantId(m.id);
            setMerchantSearch(m.name);
          }}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="tx-desc">Description</Label>
        <Input
          id="tx-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tx-tags">Tags (comma-separated)</Label>
        <Input
          id="tx-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. work, reimbursable"
        />
      </div>

      {/* Fee */}
      <div className="space-y-2">
        <Label htmlFor="tx-fee">Fee amount</Label>
        <Input
          id="tx-fee"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="tabular-nums"
          value={formatMoneyInputDisplay(feeAmount)}
          onChange={(e) => setFeeAmount(sanitizeMoneyInputNonNegative(e.target.value))}
          placeholder="0.00"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving…" : "Add transaction"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────
interface Props {
  initialTransactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  merchants: Merchant[];
  creditCards: CreditCard[];
  isPro: boolean;
  /** Inclusive YYYY-MM-DD — free tier only loads from this date onward. */
  freeHistoryMinDate?: string;
}

const PAGE_SIZE = 50;

export function TransactionsPageClient({
  initialTransactions,
  accounts,
  categories,
  merchants,
  creditCards,
  isPro,
  freeHistoryMinDate,
}: Props) {
  const router = useRouter();

  const categoriesSorted = useMemo(() => sortByLocaleName(categories), [categories]);
  const merchantsSorted = useMemo(() => sortByLocaleName(merchants), [merchants]);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("__all__");
  const [search, setSearch] = useState("");

  // Pagination
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, startLoadMore] = useTransition();

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    return initialTransactions.filter((tx) => {
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;
      if (typeFilter !== "__all__" && tx.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const inDesc = tx.description?.toLowerCase().includes(q);
        const inMerchant = tx.merchants?.name.toLowerCase().includes(q);
        const inCat = tx.categories?.name.toLowerCase().includes(q);
        if (!inDesc && !inMerchant && !inCat) return false;
      }
      return true;
    });
  }, [initialTransactions, dateFrom, dateTo, typeFilter, search]);

  const visible = filtered.slice(0, visibleCount);

  function exportCSV() {
    const rows = filtered.map((tx) => ({
      Date: tx.date,
      Type: TX_TYPE_LABELS[tx.type] ?? tx.type,
      Description: tx.description ?? "",
      Merchant: tx.merchants?.name ?? "",
      Category: tx.categories?.name ?? "",
      Amount: tx.amount,
      Currency: tx.currency_code,
      Fee: tx.fee_amount,
      Account: tx.accounts?.name ?? "",
      Tags: tx.tags?.join(", ") ?? "",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold text-foreground sm:text-2xl">
            Transactions
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {!isPro && freeHistoryMinDate && (
              <span className="block sm:inline sm:before:content-['·_'] sm:before:mr-1">
                Free plan: history from {formatDate(freeHistoryMinDate, "MMM d, yyyy")} onward
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" size="sm" onClick={exportCSV} className="w-full sm:w-auto">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setSheetOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add transaction
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3">
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
            placeholder="From"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
            placeholder="To"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {TX_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="flex-1 min-w-[180px]"
          placeholder="Search description, merchant, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(dateFrom || dateTo || typeFilter !== "__all__" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setTypeFilter("__all__");
              setSearch("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="font-semibold text-foreground">No transactions found</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters or add a transaction.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Description
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Merchant
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Account
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((tx) => (
                  <tr key={tx.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                      {formatDate(tx.date, "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <TypeBadge type={tx.type} />
                        {tx.type === "income" && tx.income_type && (
                          <Badge variant="secondary" className="text-xs w-fit">
                            {tx.income_type}
                          </Badge>
                        )}
                        {tx.type === "income" && !tx.is_collected && (
                          <span className="inline-flex items-center gap-1 text-xs text-warning-700">
                            <AlertCircle className="h-3 w-3" />
                            Uncollected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-foreground max-w-[180px] truncate">
                        {tx.description ?? <span className="text-muted-foreground">—</span>}
                      </p>
                      {tx.tags && tx.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {tx.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-foreground whitespace-nowrap">
                      {tx.merchants?.name ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {tx.categories ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
                          style={{
                            background: `${tx.categories.color ?? "#6b7280"}15`,
                            borderColor: `${tx.categories.color ?? "#6b7280"}30`,
                            color: tx.categories.color ?? "#6b7280",
                          }}
                        >
                          {tx.categories.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <AmountDisplay tx={tx} />
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-xs">
                      {tx.accounts?.name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {filtered.length > visibleCount && (
            <div className="border-t border-border px-4 py-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {visibleCount} of {filtered.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() =>
                  startLoadMore(() =>
                    setVisibleCount((n) => n + PAGE_SIZE)
                  )
                }
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Transaction Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add transaction</SheetTitle>
            <SheetDescription>
              Record a new income, expense, transfer or card transaction.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TransactionForm
              accounts={accounts}
              categories={categoriesSorted}
              merchants={merchantsSorted}
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
