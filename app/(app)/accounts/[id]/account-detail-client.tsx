"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  CreditCard,
  Receipt,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  cn,
  formatCurrency,
  formatDate,
  TX_TYPE_LABELS,
  sortByLocaleName,
} from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { AccountDeleteDialog } from "@/components/accounts/account-delete-dialog";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import {
  TransactionForm,
  TypeBadge,
  AmountDisplay,
  type TxType,
} from "@/app/(app)/transactions/transactions-client";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  categories: { name: string; color: string | null } | null;
  merchants: { name: string } | null;
};
type AccountLite = { id: string; name: string; currency_code: string; type: string };
type Category = { id: string; name: string; color: string | null; type: string };
type Merchant = { id: string; name: string };
type CreditCard = { id: string; name: string; last_four: string | null; currency_code: string };

const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "checking", label: "Checking" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "cash", label: "Cash" },
] as const;

function flowLabel(
  tx: Transaction,
  focusAccountId: string,
  accountNames: Record<string, string>
) {
  if (tx.type === "transfer") {
    if (tx.from_account_id === focusAccountId && tx.to_account_id) {
      return `To ${accountNames[tx.to_account_id] ?? "Account"}`;
    }
    if (tx.to_account_id === focusAccountId && tx.from_account_id) {
      return `From ${accountNames[tx.from_account_id] ?? "Account"}`;
    }
  }
  if (tx.type === "income" && tx.to_account_id === focusAccountId) return "Deposit";
  if (tx.type === "expense" && tx.from_account_id === focusAccountId) return "Withdrawal";
  if (tx.type === "credit_payment" && tx.from_account_id === focusAccountId) return "Card payment";
  if (tx.credit_card_id) return "Card activity";
  return "—";
}

interface Props {
  account: AccountRow;
  initialTransactions: Transaction[];
  accounts: AccountLite[];
  categories: Category[];
  merchants: Merchant[];
  creditCards: CreditCard[];
}

export function AccountDetailClient({
  account,
  initialTransactions,
  accounts,
  categories,
  merchants,
  creditCards,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const router = useRouter();
  const supabase = createClient();

  const categoriesSorted = useMemo(() => sortByLocaleName(categories), [categories]);
  const merchantsSorted = useMemo(() => sortByLocaleName(merchants), [merchants]);

  const [transactions, setTransactions] = useState(initialTransactions);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [presetType, setPresetType] = useState<TxType>("expense");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const accountNames = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a.name])),
    [accounts]
  );

  const typeLabel = ACCOUNT_TYPES.find((t) => t.value === account.type)?.label ?? account.type;

  function openSheet(type: TxType) {
    setPresetType(type);
    setSheetOpen(true);
  }

  async function handleSoftDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("id", account.id);
    setDeleteLoading(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setDeleteOpen(false);
    router.push("/accounts");
    router.refresh();
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to accounts
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${account.color ?? "#032e6d"}20` }}
            >
              <Landmark className="h-6 w-6" style={{ color: account.color ?? "#032e6d" }} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{account.name}</h1>
              {account.institution && (
                <p className="text-sm text-muted-foreground">{account.institution}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">{typeLabel}</Badge>
                <Badge variant="outline">{account.currency_code}</Badge>
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-muted-foreground">Current balance</p>
            <p
              className={cn(
                "text-3xl font-display font-bold tabular-nums",
                account.balance >= 0 ? "text-foreground" : "text-destructive"
              )}
            >
              {formatCurrency(account.balance, displayCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => openSheet("expense")}>
          <Receipt className="h-4 w-4" />
          Pay / expense
        </Button>
        <Button size="sm" variant="outline" onClick={() => openSheet("income")}>
          <ArrowDownLeft className="h-4 w-4" />
          Deposit / income
        </Button>
        <Button size="sm" variant="outline" onClick={() => openSheet("transfer")}>
          <ArrowRightLeft className="h-4 w-4" />
          Transfer
        </Button>
        <Button size="sm" variant="outline" onClick={() => openSheet("credit_payment")}>
          <CreditCard className="h-4 w-4" />
          Pay card
        </Button>
        <Button size="sm" onClick={() => openSheet("credit_charge")}>
          <CreditCard className="h-4 w-4" />
          Card charge
        </Button>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-3">
          Transactions for this account
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-border rounded-xl bg-card/50">
            <ArrowUpRight className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-medium text-foreground">No activity yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Add income, expenses, transfers, or card payments — they will show up here.
            </p>
            <Button className="mt-4" onClick={() => openSheet("expense")}>
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
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
                      Flow
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Description
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Category
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                        {formatDate(tx.date, "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-4">
                        <TypeBadge type={tx.type} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs max-w-[140px]">
                        {flowLabel(tx, account.id, accountNames)}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-foreground max-w-[200px] truncate">
                          {tx.description ?? "—"}
                        </p>
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
                        <AmountDisplay tx={tx as any} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-destructive/25 bg-destructive/[0.03] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete this account</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Removes the account from your list. Past transactions remain in your history (soft delete).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            disabled={deleteLoading}
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </Button>
        </div>
        {deleteError && (
          <p className="text-sm text-destructive mt-2" role="alert">
            {deleteError}
          </p>
        )}
      </div>

      <AccountDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!deleteLoading) setDeleteOpen(o);
        }}
        accountName={account.name}
        loading={deleteLoading}
        onConfirm={handleSoftDelete}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add transaction</SheetTitle>
            <SheetDescription>
              Record activity for {account.name}. Transfers still need a destination account; other types use this account automatically.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TransactionForm
              key={`${account.id}-${presetType}-${sheetOpen}`}
              accounts={accounts}
              categories={categoriesSorted}
              merchants={merchantsSorted}
              creditCards={creditCards}
              contextAccountId={account.id}
              defaultCurrency={account.currency_code}
              initialType={presetType}
              onSuccess={() => {
                setSheetOpen(false);
                router.refresh();
              }}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
