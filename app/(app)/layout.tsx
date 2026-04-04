import React from "react";

// All app routes require authentication and dynamic rendering
export const dynamic = "force-dynamic";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { isProSubscriber } from "@/lib/subscription-access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPro = false;
  let baseCurrency = "PHP";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, plan_expires_at, base_currency")
      .eq("id", user.id)
      .single();
    isPro = isProSubscriber(profile);
    baseCurrency = profile?.base_currency ?? "PHP";
  }

  return (
    <AppShell isPro={isPro} baseCurrency={baseCurrency}>
      {children}
    </AppShell>
  );
}
