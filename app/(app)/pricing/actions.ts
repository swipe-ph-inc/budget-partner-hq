"use server";

import { createClient } from "@/lib/supabase/server";
import { absolutizeAppOrigin } from "@/lib/app-origin";
import { revalidatePath } from "next/cache";

export type SelectablePlanId = "free" | "pro_monthly" | "pro_annual";

/** Creates a PayMongo checkout session and returns the hosted checkout URL. */
export async function createPaymongoCheckout(
  plan: "pro_monthly" | "pro_annual"
): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You must be signed in to upgrade." };

  const appUrl = absolutizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000");

  const res = await fetch(`${appUrl}/api/paymongo/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });

  const data = (await res.json()) as { checkoutUrl?: string; error?: string };

  if (!res.ok || !data.checkoutUrl) {
    return { ok: false, error: data.error ?? "Failed to start checkout." };
  }

  return { ok: true, checkoutUrl: data.checkoutUrl };
}

/** Downgrades the current user to Free. Pro upgrades go through PayMongo checkout only. */
export async function downgradeTofree(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to change plans." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ plan: "free" as const, plan_expires_at: null, plan_interval: null })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/pricing");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
