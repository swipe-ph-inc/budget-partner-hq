import type { Database } from "@/types/database";

type PlanRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "plan" | "plan_expires_at"
> | null;

/** Max active accounts or credit cards on the free plan. */
export const FREE_TIER_ACCOUNT_LIMIT = 3;
export const FREE_TIER_CREDIT_CARD_LIMIT = 3;

/** Rolling window (days) for transaction & expense history on the free plan. */
export const FREE_TIER_HISTORY_DAYS = 30;

export function isProSubscriber(profile: PlanRow | undefined): boolean {
  if (!profile || profile.plan !== "pro") return false;
  if (!profile.plan_expires_at) return true;
  return new Date(profile.plan_expires_at) > new Date();
}

/** Inclusive start date (YYYY-MM-DD) for free-tier history queries. */
export function freeTierHistoryStartDate(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - FREE_TIER_HISTORY_DAYS);
  return d.toISOString().slice(0, 10);
}
