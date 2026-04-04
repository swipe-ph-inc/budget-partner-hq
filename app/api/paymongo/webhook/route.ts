import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paymongo";

// PayMongo webhook — receives payment events and activates Pro on the user profile.
// Register this URL once in your PayMongo dashboard under Developers > Webhooks:
//   https://<your-domain>/api/paymongo/webhook
// Listen for the event: checkout_session.payment.paid

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("paymongo-signature") ?? "";
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[paymongo/webhook] PAYMONGO_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaymongoWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaymongoWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event?.data?.attributes?.type;

  if (eventType === "checkout_session.payment.paid") {
    const sessionAttrs = event.data.attributes.data?.attributes;
    const metadata = sessionAttrs?.metadata as Record<string, string> | undefined;
    const userId = metadata?.user_id;
    const planInterval = metadata?.plan_interval as "monthly" | "annual" | undefined;

    if (!userId || !planInterval) {
      // Not a subscription checkout we initiated — ignore
      return NextResponse.json({ received: true });
    }

    const expiresAt = new Date();
    if (planInterval === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    const supabase = await createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        plan: "pro",
        plan_interval: planInterval,
        plan_expires_at: expiresAt.toISOString(),
        paymongo_checkout_session_id: null, // clear after confirmed
      })
      .eq("id", userId);

    if (error) {
      console.error("[paymongo/webhook] Failed to update profile:", error.message);
      // Return 200 anyway to prevent PayMongo from retrying — log and investigate
    }
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}

// --- Types ---

interface PaymongoWebhookEvent {
  data: {
    attributes: {
      type: string;
      data?: {
        attributes?: {
          metadata?: Record<string, unknown>;
          [key: string]: unknown;
        };
      };
    };
  };
}
