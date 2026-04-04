import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { processDueSubscriptions } from "@/lib/subscriptions/process-due";
import { generateNotificationsForUser } from "@/lib/notifications/generate";

/**
 * Daily cron job — processes due subscriptions for ALL users.
 *
 * Protected by CRON_SECRET env variable. Vercel cron (or any external
 * scheduler) must send:  Authorization: Bearer <CRON_SECRET>
 *
 * Schedule is defined in vercel.json (runs 01:00 UTC daily).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();
  const results = await processDueSubscriptions(supabase);

  const totalTx = results.reduce((s, r) => s + r.transactions_created, 0);
  const skipped = results.filter((r) => r.skipped);

  // After processing, generate fresh notifications for each user who had new transactions.
  if (totalTx > 0) {
    const { data: processedSubs } = await supabase
      .from("subscriptions")
      .select("user_id")
      .in("id", results.map((r) => r.subscription_id));

    const uniqueUserIds = [...new Set((processedSubs ?? []).map((s) => s.user_id))];
    await Promise.all(uniqueUserIds.map((uid) => generateNotificationsForUser(supabase, uid)));
  }

  return NextResponse.json({
    processed: results.length,
    transactions_created: totalTx,
    skipped: skipped.length,
    results,
  });
}

// Allow Vercel cron to call this via GET as well
export async function GET(req: NextRequest) {
  return POST(req);
}
