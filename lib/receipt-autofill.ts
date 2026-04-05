import type { ParsedReceipt } from "@/app/api/ai/parse-receipt/route";

type MerchantRow = { id: string; name: string };
type CategoryRow = { id: string; name: string };

const JUNK_MERCHANT = /^(cashier|customer|thank\s*you|total|subtotal|gst|vat|tax|change|amount|balance|invoice|receipt|pos|terminal|ref#?|transaction)$/i;

/**
 * Pick an existing merchant when OCR text is close; avoid stuffing wrong names into the search box.
 */
export function bestMerchantMatch(
  merchants: MerchantRow[],
  ocrName: string | null | undefined
): { merchantId: string | null; searchLabel: string } {
  const raw = ocrName?.trim() ?? "";
  if (!raw || raw.length > 120) return { merchantId: null, searchLabel: "" };

  const lower = raw.toLowerCase();
  if (lower.length < 2 || JUNK_MERCHANT.test(lower)) {
    return { merchantId: null, searchLabel: "" };
  }

  const exact = merchants.find((m) => m.name.toLowerCase() === lower);
  if (exact) return { merchantId: exact.id, searchLabel: exact.name };

  const contains = merchants
    .filter((m) => {
      const ml = m.name.toLowerCase();
      return ml.includes(lower) || lower.includes(ml);
    })
    .sort((a, b) => b.name.length - a.name.length);

  if (contains.length > 0) {
    const best = contains[0];
    return { merchantId: best.id, searchLabel: best.name };
  }

  return { merchantId: null, searchLabel: raw };
}

/**
 * Map AI category_hint to a user category — prefer exact / strong matches only.
 */
export function matchCategoryFromHint(
  categories: CategoryRow[],
  hint: string | null | undefined
): string | null {
  const h = hint?.trim().toLowerCase();
  if (!h) return null;

  const exact = categories.find((c) => c.name.toLowerCase() === h);
  if (exact) return exact.id;

  const contains = categories.filter(
    (c) => c.name.toLowerCase().includes(h) || h.includes(c.name.toLowerCase())
  );
  if (contains.length === 1) return contains[0].id;

  return null;
}

/** Append merchant note when we could not link a merchant row. */
export function mergeMerchantIntoDescription(
  description: string,
  merchantFromReceipt: string | null | undefined
): string {
  const m = merchantFromReceipt?.trim();
  if (!m || m.length > 200) return description;
  const base = description.trim();
  const tag = `Store (receipt): ${m}`;
  if (!base) return tag;
  if (base.toLowerCase().includes(m.toLowerCase().slice(0, 8))) return base;
  return `${base} · ${tag}`;
}

/** Format a numeric amount for money inputs (commas handled by parse step). */
export function amountToInputString(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(Number(n.toFixed(2)));
}

export type SafeReceiptApply = {
  amountStr: string | null;
  date: string | null;
  currency: string | null;
  description: string | null;
  feeStr: string | null;
  merchantId: string | null;
  merchantSearch: string;
  /** When true, put unmatched OCR merchant into description instead of merchant field. */
  merchantNoteOnly: boolean;
  categoryId: string | null;
  /** For transactions: safe type hint — never "income" from receipts unless explicit. */
  txType: ParsedReceipt["type"];
};

export function buildSafeReceiptApply(
  parsed: ParsedReceipt,
  opts: {
    merchants: MerchantRow[];
    categories: CategoryRow[];
    /** Allowed ISO currency codes for the form */
    allowedCurrencies: readonly string[];
  }
): SafeReceiptApply {
  const { merchants, categories, allowedCurrencies } = opts;

  let amountStr: string | null = null;
  if (parsed.amount != null && Number.isFinite(parsed.amount)) {
    const n = Math.round(parsed.amount * 100) / 100;
    if (n > 0 && n <= 1_000_000_000) amountStr = amountToInputString(n);
  }

  let date: string | null = null;
  if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) date = parsed.date;

  let currency: string | null = null;
  if (parsed.currency && allowedCurrencies.includes(parsed.currency)) currency = parsed.currency;

  const { merchantId, searchLabel } = bestMerchantMatch(merchants, parsed.merchant);
  const merchantNoteOnly = !merchantId && Boolean(searchLabel);

  let description = parsed.description?.trim() ?? null;
  if (merchantNoteOnly && searchLabel) {
    description = mergeMerchantIntoDescription(description ?? "", searchLabel);
  }

  const categoryId = matchCategoryFromHint(categories, parsed.category_hint);

  let feeStr: string | null = null;
  if (parsed.fee_amount != null && Number.isFinite(parsed.fee_amount)) {
    const f = Math.round(parsed.fee_amount * 100) / 100;
    if (f >= 0 && f <= 1_000_000_000) feeStr = amountToInputString(f);
  }

  let txType: ParsedReceipt["type"] = parsed.type ?? "expense";
  if (txType === "income") txType = "expense";

  return {
    amountStr,
    date,
    currency,
    description,
    feeStr,
    merchantId,
    merchantSearch: merchantId ? searchLabel : merchantNoteOnly ? "" : searchLabel,
    merchantNoteOnly,
    categoryId,
    txType,
  };
}
