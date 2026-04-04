import { createHmac, timingSafeEqual } from "crypto";

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

function authHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export interface PaymongoLineItem {
  amount: number; // smallest currency unit (e.g. cents for USD)
  currency: string;
  name: string;
  quantity: number;
  description?: string;
}

export interface PaymongoCheckoutSession {
  id: string;
  checkoutUrl: string;
}

export async function createCheckoutSession(params: {
  lineItems: PaymongoLineItem[];
  paymentMethodTypes: string[];
  successUrl: string;
  cancelUrl: string;
  description: string;
  metadata: Record<string, string>;
}): Promise<PaymongoCheckoutSession> {
  const res = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: params.lineItems.map(({ amount, currency, name, quantity, description }) => ({
            amount,
            currency,
            name,
            quantity,
            ...(description && { description }),
          })),
          payment_method_types: params.paymentMethodTypes,
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          description: params.description,
          metadata: params.metadata,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { errors?: { detail: string }[] };
    throw new Error(body?.errors?.[0]?.detail ?? `PayMongo error ${res.status}`);
  }

  const { data } = await res.json() as { data: { id: string; attributes: { checkout_url: string } } };
  return { id: data.id, checkoutUrl: data.attributes.checkout_url };
}

/**
 * Verifies a PayMongo webhook signature.
 * Header format: t=<timestamp>,te=<test_sig>,li=<live_sig>
 * Algorithm: HMAC-SHA256(timestamp + "." + rawBody, webhookSecret)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  const parts: Record<string, string> = {};
  for (const chunk of signatureHeader.split(",")) {
    const idx = chunk.indexOf("=");
    if (idx > 0) parts[chunk.slice(0, idx)] = chunk.slice(idx + 1);
  }

  const timestamp = parts["t"];
  if (!timestamp) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", webhookSecret).update(payload).digest("hex");

  // In live mode use "li"; fall back to "te" for test mode
  const sig = parts["li"] || parts["te"];
  if (!sig) return false;
  try {
    // Use constant-time comparison to prevent timing attacks
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
