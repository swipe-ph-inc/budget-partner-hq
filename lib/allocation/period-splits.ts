/** Average weeks per month (used to derive a weekly slice from a monthly discretionary amount). */
export const WEEKS_PER_MONTH = 4.345;

/** Approximate bi-weekly periods per month (half-month slices). */
export const BIWEEKLY_PER_MONTH = 2.172;

export type SafeToSpendSplits = {
  weekly: number;
  biWeekly: number;
  monthly: number;
  quarterly: number;
  yearly: number;
};

/**
 * Derives period views from a single monthly `safe_to_spend` plan (display only).
 */
export function splitSafeToSpend(safeToSpend: number | null | undefined): SafeToSpendSplits {
  const s = safeToSpend ?? 0;
  if (s <= 0) {
    return { weekly: 0, biWeekly: 0, monthly: 0, quarterly: 0, yearly: 0 };
  }
  return {
    weekly: s / WEEKS_PER_MONTH,
    biWeekly: s / BIWEEKLY_PER_MONTH,
    monthly: s,
    quarterly: s * 3,
    yearly: s * 12,
  };
}
