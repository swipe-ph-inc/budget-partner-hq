"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Landmark, Wallet, CreditCard, Banknote, MoreHorizontal, Pencil, Archive, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";
import {
  sanitizeMoneyInput,
  formatMoneyInputDisplay,
  numericToMoneyRaw,
  parseMoneyInput,
} from "@/lib/money-input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/types/database";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings", icon: TrendingUp, color: "#28c095" },
  { value: "checking", label: "Checking", icon: Landmark, color: "#032e6d" },
  { value: "ewallet", label: "E-Wallet", icon: Wallet, color: "#cea843" },
  { value: "cash", label: "Cash", icon: Banknote, color: "#6b6350" },
] as const;

const ACCOUNT_COLORS = ["#032e6d", "#28c095", "#cea843", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#6b6350"];

/** Balance is derived from transactions; use income/expense rows so DB triggers stay correct. */
async function applyBalanceChange(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accountId: string,
  currencyCode: string,
  delta: number,
  txDescription = "Balance adjustment"
): Promise<{ error: { message: string } | null }> {
  const today = format(new Date(), "yyyy-MM-dd");
  const amt = Math.abs(delta);
  if (amt < 0.0001) return { error: null };

  if (delta > 0) {
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "income",
      income_type: "other",
      is_collected: true,
      date: today,
      amount: amt,
      currency_code: currencyCode,
      to_account_id: accountId,
      description: txDescription,
    });
    return { error };
  }
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type: "expense",
    is_collected: true,
    date: today,
    amount: amt,
    currency_code: currencyCode,
    from_account_id: accountId,
    description: txDescription,
  });
  return { error };
}

function AccountCard({ account, onEdit }: { account: Account; onEdit: (a: Account) => void }) {
  const typeInfo = ACCOUNT_TYPES.find((t) => t.value === account.type);
  const Icon = typeInfo?.icon ?? Landmark;

  return (
    <div
      className="card-hover group relative cursor-pointer overflow-hidden p-5"
      style={{ borderLeftColor: account.color ?? typeInfo?.color, borderLeftWidth: 4 }}
    >
      {/* Text sits below the link in paint order; link is on top and receives clicks */}
      <div className="pointer-events-none relative z-0">
        <div className="flex items-start justify-between gap-4 pr-1">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${account.color ?? typeInfo?.color}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: account.color ?? typeInfo?.color }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
              {account.institution && (
                <p className="truncate text-xs text-muted-foreground">{account.institution}</p>
              )}
            </div>
          </div>
          {/* Reserve space for the absolute menu button so title doesn’t overlap */}
          <span className="h-9 w-9 shrink-0" aria-hidden />
        </div>

        <div className="mt-4">
          <p className={cn("font-display text-xl font-bold", account.balance >= 0 ? "text-foreground" : "text-destructive")}>
            {formatCurrency(account.balance, account.currency_code)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={account.type === "savings" ? "success" : account.type === "checking" ? "default" : "secondary"} className="text-xs">
              {typeInfo?.label ?? account.type}
            </Badge>
          </div>
        </div>
      </div>

      <Link
        href={`/accounts/${account.id}`}
        className="absolute inset-0 z-10 rounded-[inherit]"
        aria-label={`View ${account.name}`}
      />

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit(account);
        }}
        className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-md p-1 opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function AccountForm({
  account,
  onSuccess,
  onClose,
  canAddAccount,
  accountLimit,
}: {
  account?: Account;
  onSuccess: () => void;
  onClose: () => void;
  canAddAccount: boolean;
  accountLimit: number;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "savings");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [currency, setCurrency] = useState(account?.currency_code ?? "PHP");
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[0]);
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [startingBalance, setStartingBalance] = useState("");
  const [balanceInput, setBalanceInput] = useState(account ? numericToMoneyRaw(account.balance) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (account) setBalanceInput(numericToMoneyRaw(account.balance));
    else setStartingBalance("");
  }, [account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const payload = { name, type, institution: institution || null, currency_code: currency, color, notes: notes || null };

    if (!account) {
      if (!canAddAccount) {
        setError(`Free plan allows up to ${accountLimit} accounts. Upgrade to Pro for more.`);
        setLoading(false);
        return;
      }
      const open = parseMoneyInput(startingBalance);
      if (open === null) { setError("Enter a valid starting balance (or 0)."); setLoading(false); return; }

      const { data: created, error: insErr } = await supabase
        .from("accounts")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();

      if (insErr || !created) { setError(insErr?.message ?? "Could not create account"); setLoading(false); return; }

      if (open !== 0) {
        const { error: txErr } = await applyBalanceChange(
          supabase,
          user.id,
          created.id,
          currency,
          open,
          "Opening balance"
        );
        if (txErr) { setError(txErr.message); setLoading(false); return; }
      }
    } else {
      const { error: upErr } = await supabase.from("accounts").update(payload).eq("id", account.id);
      if (upErr) { setError(upErr.message); setLoading(false); return; }

      const target = parseMoneyInput(balanceInput);
      if (target === null) { setError("Enter a valid balance."); setLoading(false); return; }

      const delta = target - account.balance;
      if (Math.abs(delta) >= 0.0001) {
        const { error: txErr } = await applyBalanceChange(supabase, user.id, account.id, currency, delta);
        if (txErr) { setError(txErr.message); setLoading(false); return; }
      }
    }

    router.refresh();
    onSuccess();
  }

  async function handleArchive() {
    if (!account) return;
    setLoading(true);
    await supabase.from("accounts").update({ is_active: false }).eq("id", account.id);
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="acc-name">Account name *</Label>
        <Input id="acc-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BDO Savings" />
      </div>

      <div className="space-y-2">
        <Label>Account type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                type === t.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="acc-institution">Institution / Provider</Label>
        <Input id="acc-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. BDO, GCash, BPI" />
      </div>

      <div className="space-y-2">
        <Label>Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!account && !canAddAccount && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-800">
          You&apos;ve reached the free plan limit of {accountLimit} accounts. Upgrade to Pro in Profile to add more.
        </div>
      )}

      {!account ? (
        <div className="space-y-2">
          <Label htmlFor="acc-starting-balance">Starting balance</Label>
          <Input
            id="acc-starting-balance"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            value={formatMoneyInputDisplay(startingBalance)}
            onChange={(e) => setStartingBalance(sanitizeMoneyInput(e.target.value))}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Stored as an opening-balance entry so the total matches your transactions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="acc-balance">Balance</Label>
          <Input
            id="acc-balance"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            value={formatMoneyInputDisplay(balanceInput)}
            onChange={(e) => setBalanceInput(sanitizeMoneyInput(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Edits create a small adjustment so the running total stays correct with your transaction history.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Card colour</Label>
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_COLORS.map((c) => (
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

      <div className="space-y-2">
        <Label htmlFor="acc-notes">Notes</Label>
        <Input id="acc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading || (!account && !canAddAccount)} className="flex-1">
          {loading ? "Saving…" : account ? "Update account" : "Add account"}
        </Button>
        {account && (
          <Button type="button" variant="outline" onClick={handleArchive} disabled={loading}>
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

interface Props {
  initialAccounts: Account[];
  baseCurrency: string;
  isPro: boolean;
  canAddAccount: boolean;
  accountLimit: number;
}

export function AccountsPageClient({
  initialAccounts,
  baseCurrency,
  isPro,
  canAddAccount,
  accountLimit,
}: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);

  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const router = useRouter();

  const grouped = ACCOUNT_TYPES.map((type) => ({
    ...type,
    accounts: accounts.filter((a) => a.type === type.value),
  })).filter((g) => g.accounts.length > 0);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  function openNew() {
    setEditingAccount(undefined);
    setSheetOpen(true);
  }

  function openEdit(account: Account) {
    setEditingAccount(account);
    setSheetOpen(true);
  }

  function handleSuccess() {
    setSheetOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Total across all accounts</p>
          <p className="mt-0.5 text-2xl font-display font-bold text-foreground sm:text-3xl">
            {formatCurrency(totalBalance, baseCurrency)}
          </p>
        </div>
        <Button
          onClick={openNew}
          className="w-full shrink-0 sm:w-auto"
          disabled={!canAddAccount}
          title={!canAddAccount ? `Free plan: max ${accountLimit} accounts` : undefined}
        >
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </div>
      {!isPro && (
        <p className="text-xs text-muted-foreground sm:text-right">
          Free plan: up to {accountLimit} accounts
          {!canAddAccount && " — limit reached"}
        </p>
      )}

      {/* Account groups */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <Landmark className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No accounts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your savings, checking, e-wallet, and cash accounts to get started.
            </p>
          </div>
          <Button onClick={openNew} disabled={!canAddAccount}>
            <Plus className="h-4 w-4" />
            Add your first account
          </Button>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.value}>
            <div className="flex items-center gap-2 mb-4">
              <group.icon className="h-4 w-4" style={{ color: group.color }} />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </h2>
              <span className="text-xs text-muted-foreground">({group.accounts.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.accounts.map((account) => (
                <AccountCard key={account.id} account={account} onEdit={openEdit} />
              ))}
            </div>
          </section>
        ))
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingAccount ? "Edit account" : "Add account"}</SheetTitle>
            <SheetDescription>
              {editingAccount ? "Update your account details." : "Add a new financial account to track."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <AccountForm
              key={editingAccount?.id ?? "new"}
              account={editingAccount}
              onSuccess={handleSuccess}
              onClose={() => setSheetOpen(false)}
              canAddAccount={canAddAccount || !!editingAccount}
              accountLimit={accountLimit}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
