import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDueSubscriptions } from "@/lib/subscriptions/process-due";

/**
 * User-facing endpoint — processes due subscriptions for the authenticated user only.
 * Called by the "Process due" button on the subscriptions page.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await processDueSubscriptions(supabase, user.id);

  const totalTx = results.reduce((s, r) => s + r.transactions_created, 0);

  return NextResponse.json({
    processed: results.length,
    transactions_created: totalTx,
    results,
  });
}
