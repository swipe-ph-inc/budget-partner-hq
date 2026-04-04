/** Display and PayMongo checkout — prices in USD. */

export const PRO_MONTHLY_PRICE_USD = 9.99;

/** 12 × monthly with 17% discount (pay 83% of full-year monthly total). */
export function proAnnualPriceUsd(): number {
  const fullYearAtMonthly = PRO_MONTHLY_PRICE_USD * 12;
  return Math.round(fullYearAtMonthly * (1 - 0.17) * 100) / 100;
}

export const PRO_ANNUAL_DISCOUNT_PERCENT = 17;

export function formatPlanMoneyUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
