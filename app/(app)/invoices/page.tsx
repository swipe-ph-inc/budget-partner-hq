import { createClient } from "@/lib/supabase/server";
import { InvoicesPageClient } from "./invoices-client";
import { isProSubscriber } from "@/lib/subscription-access";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: planProfile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", user!.id)
    .single();

  if (!isProSubscriber(planProfile)) {
    return (
      <UpgradePrompt
        title="Invoices are a Pro feature"
        description="Upgrade to Pro to create and manage invoices and line items for your freelance or business income."
      />
    );
  }

  const [{ data: invoices }, { data: lineItems }, { data: profile }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase.from("invoice_line_items").select("*"),
      supabase
        .from("profiles")
        .select("base_currency")
        .eq("id", user!.id)
        .single(),
    ]);

  return (
    <InvoicesPageClient
      initialInvoices={invoices ?? []}
      initialLineItems={lineItems ?? []}
      baseCurrency={profile?.base_currency ?? "PHP"}
    />
  );
}
