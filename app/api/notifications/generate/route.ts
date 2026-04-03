import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateNotificationsForUser } from "@/lib/notifications/generate";

/** POST /api/notifications/generate — generate fresh notifications for the current user */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await generateNotificationsForUser(supabase, user.id);
  return NextResponse.json({ generated: count });
}
