"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SelectablePlanId = "free" | "pro_monthly" | "pro_annual";

export async function selectPlan(plan: SelectablePlanId): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to change plans." };
  }

  const row =
    plan === "free"
      ? {
          plan: "free" as const,
          plan_expires_at: null as string | null,
          plan_interval: null as null,
        }
      : {
          plan: "pro" as const,
          plan_expires_at: null as string | null,
          plan_interval: (plan === "pro_monthly" ? "monthly" : "annual") as "monthly" | "annual",
        };

  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/pricing");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
