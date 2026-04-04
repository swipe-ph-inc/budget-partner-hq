import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isProSubscriber } from "@/lib/subscription-access";
import { PricingPageClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Plans & pricing",
  description: "Choose Free, Pro, or Pro Annual for Budget Partner HQ.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PricingPageClient
        currentPlan="free"
        isPro={false}
        planInterval={null}
        isSignedIn={false}
      />
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at, plan_interval")
    .eq("id", user.id)
    .single();

  const isPro = isProSubscriber(profile);
  const interval = profile?.plan_interval ?? null;

  return (
    <PricingPageClient
      currentPlan={profile?.plan ?? "free"}
      isPro={isPro}
      planInterval={interval}
      isSignedIn
    />
  );
}
