import { createClient } from "@/lib/supabase/server";
import CalendarClient from "./calendar-client";
import { isProSubscriber } from "@/lib/subscription-access";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";

export const dynamic = "force-dynamic";

type View = "month" | "week" | "day" | "year";

interface Props {
  searchParams: Promise<{ view?: string; date?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", user!.id)
    .single();

  if (!isProSubscriber(profile)) {
    return (
      <UpgradePrompt
        title="Calendar is a Pro feature"
        description="Upgrade to Pro to see transactions and due dates on a full calendar with month, week, and day views."
      />
    );
  }

  const { view: rawView, date: rawDate } = await searchParams;

  const view: View =
    rawView === "week" || rawView === "day" || rawView === "year"
      ? rawView
      : "month";

  const today = new Date();
  const anchorDate = rawDate ? new Date(rawDate + "T00:00:00") : today;
  if (isNaN(anchorDate.getTime())) {
    anchorDate.setTime(today.getTime());
  }

  // Compute the date range to fetch based on view
  let rangeStart: Date;
  let rangeEnd: Date;

  if (view === "day") {
    rangeStart = new Date(anchorDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(anchorDate);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (view === "week") {
    const day = anchorDate.getDay(); // 0=Sun
    rangeStart = new Date(anchorDate);
    rangeStart.setDate(anchorDate.getDate() - day);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 6);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (view === "year") {
    rangeStart = new Date(anchorDate.getFullYear(), 0, 1);
    rangeEnd = new Date(anchorDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    // month — include leading/trailing days visible in the 6-week grid
    const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun
    rangeStart = new Date(firstOfMonth);
    rangeStart.setDate(firstOfMonth.getDate() - startDay);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 41); // 6 weeks
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const startStr = rangeStart.toISOString().slice(0, 10);
  const endStr = rangeEnd.toISOString().slice(0, 10);

  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      "id, date, type, amount, fee_amount, description, note, categories!transactions_category_id_fkey(name, color), merchants(name), accounts!from_account_id(name, currency_code), credit_cards!transactions_credit_card_id_fkey(name)"
    )
    .eq("user_id", user!.id)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <CalendarClient
      transactions={(transactions as any) ?? []}
      initialView={view}
      initialDate={anchorDate.toISOString().slice(0, 10)}
      todayStr={today.toISOString().slice(0, 10)}
    />
  );
}
