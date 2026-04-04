import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/paymongo";
import { PRO_MONTHLY_PRICE_USD, proAnnualPriceUsd } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { plan } = body;
  if (plan !== "pro_monthly" && plan !== "pro_annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const isMonthly = plan === "pro_monthly";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // PayMongo amounts: smallest currency unit (USD cents)
  const amountMinorUnits = isMonthly
    ? Math.round(PRO_MONTHLY_PRICE_USD * 100)
    : Math.round(proAnnualPriceUsd() * 100);

  const planName = isMonthly
    ? "Budget Partner HQ Pro — Monthly"
    : "Budget Partner HQ Pro — Annual";

  const planDescription = isMonthly
    ? "Full Pro access billed monthly. Renews every 30 days."
    : "Full Pro access billed annually. 17% off vs monthly price.";

  try {
    const session = await createCheckoutSession({
      lineItems: [
        {
          amount: amountMinorUnits,
          currency: "USD",
          name: planName,
          quantity: 1,
          description: planDescription,
        },
      ],
      // Supported payment methods — enable only what your account allows
      paymentMethodTypes: ["card", "gcash", "maya", "dob"],
      // PayMongo replaces {CHECKOUT_SESSION_ID} in the success URL automatically
      successUrl: `${appUrl}/pricing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/pricing?payment=cancelled`,
      description: planName,
      metadata: {
        user_id: user.id,
        plan_interval: isMonthly ? "monthly" : "annual",
      },
    });

    // Persist the session ID so the webhook can match it to this user if needed
    await supabase
      .from("profiles")
      .update({ paymongo_checkout_session_id: session.id })
      .eq("id", user.id);

    return NextResponse.json({ checkoutUrl: session.checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
