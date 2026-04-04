"use client";

import React, { useState } from "react";
import {
  Plus,
  FileText,
  Trash2,
  Send,
  CheckCircle2,
  DollarSign,
  XCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type LineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"];

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY"];

type InvoiceStatus = Invoice["status"];

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "accent" | "income" | "expense" | "transfer" | "credit-charge" | "credit-payment";

const STATUS_BADGE_VARIANT: Record<InvoiceStatus, BadgeVariant> = {
  draft: "secondary",
  sent: "accent",
  partial: "warning",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === "paid" || invoice.status === "cancelled") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(invoice.due_date);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function computedStatus(invoice: Invoice): InvoiceStatus {
  if (isOverdue(invoice)) return "overdue";
  return invoice.status;
}

// ---- Line Item ----
interface LineItemDraft {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

function newLineItem(): LineItemDraft {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unit_price: "0",
  };
}

// ---- Invoice Form ----
function InvoiceForm({
  invoice,
  existingLineItems,
  existingInvoices,
  onSuccess,
  onClose,
}: {
  invoice?: Invoice;
  existingLineItems: LineItem[];
  existingInvoices: Invoice[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const year = new Date().getFullYear();
  const nextNum = existingInvoices.length + 1;
  const defaultNumber = `BPHQ-${year}-${String(nextNum).padStart(3, "0")}`;

  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice?.invoice_number ?? defaultNumber
  );
  const [clientName, setClientName] = useState(invoice?.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(invoice?.client_email ?? "");
  const [clientAddress, setClientAddress] = useState(invoice?.client_address ?? "");
  const [issueDate, setIssueDate] = useState(
    invoice?.issue_date ?? new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [currency, setCurrency] = useState(invoice?.currency_code ?? "PHP");
  const [taxRate, setTaxRate] = useState(String(invoice?.tax_rate ?? "0"));
  const [discountAmount, setDiscountAmount] = useState(
    String(invoice?.discount_amount ?? "0")
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() => {
    if (invoice) {
      const items = existingLineItems.filter((li) => li.invoice_id === invoice.id);
      if (items.length > 0) {
        return items.map((li) => ({
          id: li.id,
          description: li.description,
          quantity: String(li.quantity),
          unit_price: String(li.unit_price),
        }));
      }
    }
    return [newLineItem()];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  // Calculations
  const subtotal = lineItems.reduce((s, li) => {
    const qty = parseFloat(li.quantity) || 0;
    const price = parseFloat(li.unit_price) || 0;
    return s + qty * price;
  }, 0);
  const taxAmount = subtotal * ((parseFloat(taxRate) || 0) / 100);
  const discount = parseFloat(discountAmount) || 0;
  const grandTotal = subtotal + taxAmount - discount;

  function addLineItem() {
    setLineItems((prev) => [...prev, newLineItem()]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function updateLineItem(id: string, field: keyof LineItemDraft, value: string) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  }

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

    const invoicePayload = {
      invoice_number: invoiceNumber,
      client_name: clientName,
      client_email: clientEmail || null,
      client_address: clientAddress || null,
      issue_date: issueDate,
      due_date: dueDate,
      currency_code: currency,
      subtotal,
      tax_rate: parseFloat(taxRate) || 0,
      tax_amount: taxAmount,
      discount_amount: discount,
      total: grandTotal,
      notes: notes || null,
    };

    let invoiceId: string;

    if (invoice) {
      const { error: upErr } = await supabase
        .from("invoices")
        .update(invoicePayload)
        .eq("id", invoice.id);
      if (upErr) {
        setError(upErr.message);
        setLoading(false);
        return;
      }
      invoiceId = invoice.id;

      // Delete old line items
      await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", invoice.id);
    } else {
      const { data, error: insErr } = await supabase
        .from("invoices")
        .insert({ ...invoicePayload, user_id: user.id, status: "draft" })
        .select("id")
        .single();
      if (insErr || !data) {
        setError(insErr?.message ?? "Failed to create invoice");
        setLoading(false);
        return;
      }
      invoiceId = data.id;
    }

    // Insert line items
    const lineItemPayloads = lineItems
      .filter((li) => li.description.trim())
      .map((li) => {
        const qty = parseFloat(li.quantity) || 0;
        const price = parseFloat(li.unit_price) || 0;
        return {
          invoice_id: invoiceId,
          description: li.description,
          quantity: qty,
          unit_price: price,
          total: qty * price,
        };
      });

    if (lineItemPayloads.length > 0) {
      await supabase.from("invoice_line_items").insert(lineItemPayloads);
    }

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Invoice metadata */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inv-number">Invoice number *</Label>
          <Input
            id="inv-number"
            required
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
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
        <Label htmlFor="inv-client">Client name *</Label>
        <Input
          id="inv-client"
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Acme Corp"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="inv-email">Client email</Label>
        <Input
          id="inv-email"
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="client@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="inv-address">Client address</Label>
        <Textarea
          id="inv-address"
          value={clientAddress}
          onChange={(e) => setClientAddress(e.target.value)}
          placeholder="Full billing address"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inv-issue">Issue date *</Label>
          <Input
            id="inv-issue"
            type="date"
            required
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-due">Due date *</Label>
          <Input
            id="inv-due"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
          <Button type="button" size="sm" variant="outline" onClick={addLineItem}>
            <Plus className="h-3.5 w-3.5" />
            Add line
          </Button>
        </div>

        <div className="space-y-2 overflow-x-auto -mx-1 px-1">
          {/* Header */}
          <div className="grid min-w-[32rem] grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-right">Qty</span>
            <span className="col-span-3 text-right">Unit price</span>
            <span className="col-span-1" />
          </div>
          {lineItems.map((li) => {
            const lineTotal =
              (parseFloat(li.quantity) || 0) * (parseFloat(li.unit_price) || 0);
            return (
              <div key={li.id} className="grid min-w-[32rem] grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-6"
                  value={li.description}
                  onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                  placeholder="Description"
                />
                <Input
                  className="col-span-2 text-right"
                  type="number"
                  min="0"
                  step="0.01"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(li.id, "quantity", e.target.value)}
                />
                <Input
                  className="col-span-2 text-right"
                  type="number"
                  min="0"
                  step="0.01"
                  value={li.unit_price}
                  onChange={(e) => updateLineItem(li.id, "unit_price", e.target.value)}
                />
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeLineItem(li.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Line total (shown below on mobile-ish via hidden col) */}
                <div className="col-span-11 col-start-2 text-right text-xs text-muted-foreground -mt-1">
                  {formatCurrency(lineTotal, displayCurrency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium text-foreground">
            {formatCurrency(subtotal, displayCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm gap-4">
          <span className="text-muted-foreground shrink-0">Tax rate %</span>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="w-24 text-right"
          />
          <span className="font-medium text-foreground shrink-0">
            {formatCurrency(taxAmount, displayCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm gap-4">
          <span className="text-muted-foreground shrink-0">Discount</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="w-24 text-right"
          />
          <span className="font-medium text-destructive shrink-0">
            -{formatCurrency(discount, displayCurrency)}
          </span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="font-bold text-foreground">Total</span>
          <span className="text-2xl font-display font-bold text-primary">
            {formatCurrency(grandTotal, displayCurrency)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="inv-notes">Notes</Label>
        <Textarea
          id="inv-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Payment terms, thank you note, etc."
          rows={2}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving…" : invoice ? "Update invoice" : "Create invoice"}
      </Button>
    </form>
  );
}

// ---- Record Payment Dialog ----
function RecordPaymentDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const [amount, setAmount] = useState(
    String(invoice.total ?? 0)
  );
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const paid = parseFloat(amount) || 0;
    const total = invoice.total ?? 0;
    const newStatus: InvoiceStatus =
      paid >= total ? "paid" : "partial";

    await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", invoice.id);

    router.refresh();
    onClose();
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Enter the amount received for invoice {invoice.invoice_number}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount received ({invoice.currency_code})</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Invoice total: <span className="font-semibold text-foreground">
              {formatCurrency(invoice.total ?? 0, displayCurrency)}
            </span>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving…" : "Record payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Invoice Row ----
function InvoiceRow({
  invoice,
  onEdit,
}: {
  invoice: Invoice;
  onEdit: (inv: Invoice) => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const displayStatus = computedStatus(invoice);

  async function updateStatus(status: InvoiceStatus) {
    setLoading(true);
    await supabase.from("invoices").update({ status }).eq("id", invoice.id);
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      <div className="flex flex-col gap-3 py-4 px-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 bg-card border border-border rounded-lg">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{invoice.invoice_number}</p>
            <span className="text-xs text-muted-foreground">·</span>
            <p className="text-sm text-muted-foreground truncate">{invoice.client_name}</p>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span>Issued: {formatDate(invoice.issue_date)}</span>
            <span>Due: {formatDate(invoice.due_date)}</span>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="font-semibold text-sm text-foreground">
            {formatCurrency(invoice.total ?? 0, displayCurrency)}
          </p>
          <Badge
            variant={STATUS_BADGE_VARIANT[displayStatus]}
            className="mt-0.5"
          >
            {STATUS_LABELS[displayStatus]}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => onEdit(invoice)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {displayStatus === "draft" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-primary hover:bg-primary/10"
              disabled={loading}
              onClick={() => updateStatus("sent")}
              title="Mark Sent"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
          {(displayStatus === "sent" || displayStatus === "overdue" || displayStatus === "partial") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-success hover:bg-success/10"
              disabled={loading}
              onClick={() => setPaymentDialogOpen(true)}
              title="Record Payment"
            >
              <DollarSign className="h-3.5 w-3.5" />
            </Button>
          )}
          {displayStatus !== "paid" && displayStatus !== "cancelled" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-success hover:bg-success/10"
              disabled={loading}
              onClick={() => updateStatus("paid")}
              title="Mark Paid"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {displayStatus !== "cancelled" && displayStatus !== "paid" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-destructive hover:bg-destructive/10"
              disabled={loading}
              onClick={() => updateStatus("cancelled")}
              title="Cancel"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <RecordPaymentDialog
        invoice={invoice}
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
      />
    </>
  );
}

// ---- Main Page Client ----
interface Props {
  initialInvoices: Invoice[];
  initialLineItems: LineItem[];
}

export function InvoicesPageClient({
  initialInvoices,
  initialLineItems,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>();
  const [activeTab, setActiveTab] = useState<string>("all");

  const invoicesWithStatus = initialInvoices.map((inv) => ({
    ...inv,
    displayStatus: computedStatus(inv),
  }));

  function filterByTab(status: string) {
    if (status === "all") return invoicesWithStatus;
    return invoicesWithStatus.filter((inv) => inv.displayStatus === status);
  }

  const tabCounts: Record<string, number> = {
    all: invoicesWithStatus.length,
    draft: invoicesWithStatus.filter((i) => i.displayStatus === "draft").length,
    sent: invoicesWithStatus.filter((i) => i.displayStatus === "sent").length,
    partial: invoicesWithStatus.filter((i) => i.displayStatus === "partial").length,
    paid: invoicesWithStatus.filter((i) => i.displayStatus === "paid").length,
    overdue: invoicesWithStatus.filter((i) => i.displayStatus === "overdue").length,
  };

  function openNew() {
    setEditingInvoice(undefined);
    setSheetOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditingInvoice(inv);
    setSheetOpen(true);
  }

  const totalPaid = initialInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + (i.total ?? 0), 0);

  const totalOutstanding = initialInvoices
    .filter((i) => !["paid", "cancelled"].includes(i.status))
    .reduce((s, i) => s + (i.total ?? 0), 0);

  const TABS = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "partial", label: "Partial" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Invoices</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-4 sm:gap-6">
            <div>
              <p className="text-3xl font-display font-bold text-foreground">
                {formatCurrency(totalOutstanding, displayCurrency)}
              </p>
              <p className="text-xs text-muted-foreground">outstanding</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-lg font-display font-bold text-success">
                {formatCurrency(totalPaid, displayCurrency)}
              </p>
              <p className="text-xs text-muted-foreground">collected</p>
            </div>
          </div>
        </div>
        <Button onClick={openNew} className="w-full shrink-0 sm:w-auto">
          <Plus className="h-4 w-4" />
          New invoice
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {tabCounts[t.value] > 0 && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({tabCounts[t.value]})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            {filterByTab(t.value).length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.value === "all"
                    ? "No invoices yet. Create your first one."
                    : `No ${t.label.toLowerCase()} invoices.`}
                </p>
                {t.value === "all" && (
                  <Button onClick={openNew} size="sm">
                    <Plus className="h-4 w-4" />
                    New invoice
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filterByTab(t.value).map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} onEdit={openEdit} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Invoice builder sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl w-full">
          <SheetHeader>
            <SheetTitle>{editingInvoice ? "Edit invoice" : "New invoice"}</SheetTitle>
            <SheetDescription>
              {editingInvoice
                ? "Update the invoice details below."
                : "Fill in the details to create a new invoice."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <InvoiceForm
              invoice={editingInvoice}
              existingLineItems={initialLineItems}
              existingInvoices={initialInvoices}
              onSuccess={() => setSheetOpen(false)}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
