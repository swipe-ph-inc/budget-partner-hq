import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency formatting
export function formatCurrency(
  amount: number,
  currencyCode: string = "PHP",
  options: Intl.NumberFormatOptions = {}
): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/** Narrow symbol for charts/labels (e.g. ₱, $). */
export function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

// Format with symbol only
export function formatAmount(
  amount: number,
  symbol: string = "₱",
  decimals: number = 2
): string {
  const formatted = Math.abs(amount).toLocaleString("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${symbol}${formatted}`;
}

// Date formatting
export function formatDate(
  date: string | Date,
  formatStr: string = "MMM d, yyyy"
): string {
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, formatStr);
  } catch {
    return String(date);
  }
}

// Percentage
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Credit utilisation color
export function utilColour(utilisationPct: number): "green" | "amber" | "red" {
  if (utilisationPct < 30) return "green";
  if (utilisationPct <= 70) return "amber";
  return "red";
}

// Health metric colour
export function healthColour(
  value: number,
  thresholds: { green: number; amber: number }
): "green" | "amber" | "red" {
  if (value >= thresholds.green) return "green";
  if (value >= thresholds.amber) return "amber";
  return "red";
}

// Transaction type label
export const TX_TYPE_LABELS: Record<string, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  credit_payment: "Card Payment",
  credit_charge: "Card Charge",
};

// Transaction type colors
export const TX_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  income: {
    bg: "bg-success/10",
    text: "text-success-700",
    border: "border-success/20",
  },
  expense: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/20",
  },
  transfer: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  credit_charge: {
    bg: "bg-warning/10",
    text: "text-warning-700",
    border: "border-warning/20",
  },
  credit_payment: {
    bg: "bg-accent",
    text: "text-primary",
    border: "border-accent",
  },
};

// Truncate text
export function truncate(str: string, maxLength: number = 30): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

// Generate initials
export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Calculate billing cycle advance
export function advanceBillingDate(
  date: Date,
  cycle: "weekly" | "monthly" | "quarterly" | "yearly"
): Date {
  const next = new Date(date);
  switch (cycle) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

// Debt-free date calculation (simple amortisation)
export function calcDebtFreeDate(
  balance: number,
  monthlyPayment: number,
  annualRate: number
): Date | null {
  if (monthlyPayment <= 0) return null;
  const monthlyRate = annualRate / 12;
  let remaining = balance;
  const start = new Date();
  let months = 0;

  while (remaining > 0 && months < 600) {
    const interest = remaining * monthlyRate;
    const principal = monthlyPayment - interest;
    if (principal <= 0) return null; // Payment can't cover interest
    remaining -= principal;
    months++;
  }

  const result = new Date(start);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Safe number parser
export function safeNum(val: unknown, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

// Month first day
export function firstDayOfMonth(date: Date = new Date()): string {
  return format(new Date(date.getFullYear(), date.getMonth(), 1), "yyyy-MM-dd");
}

// Current month label
export function currentMonthLabel(): string {
  return format(new Date(), "MMMM yyyy");
}
