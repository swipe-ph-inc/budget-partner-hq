/**
 * Single source of truth for profile base currency and account currency pickers.
 */
export const SUPPORTED_CURRENCY_CODES = [
  "PHP",
  "USD",
  "EUR",
  "GBP",
  "SGD",
  "AUD",
  "JPY",
  "HKD",
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];

/** Ensures the current selection appears even if it is not in the supported list (legacy data). */
export function currencySelectOptions(selectedCode: string): string[] {
  const codes: string[] = [...SUPPORTED_CURRENCY_CODES];
  if (!codes.includes(selectedCode)) codes.push(selectedCode);
  return codes;
}
