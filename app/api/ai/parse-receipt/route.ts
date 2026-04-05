import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface ParsedReceipt {
  type: "expense" | "credit_charge" | "income";
  amount: number | null;
  date: string | null;
  currency: string | null;
  merchant: string | null;
  category_hint: string | null;
  description: string | null;
  fee_amount: number | null;
}

const SUPPORTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"] as const;

function isSupportedImageType(t: string): t is (typeof SUPPORTED_TYPES)[number] {
  return (SUPPORTED_TYPES as readonly string[]).includes(t);
}

function parseNumberField(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Coerce model JSON into a safe shape; drop garbage / out-of-range values. */
function coerceParsedReceipt(raw: Record<string, unknown>): ParsedReceipt {
  const t = raw.type;
  const type: ParsedReceipt["type"] =
    t === "credit_charge" || t === "income" || t === "expense" ? t : "expense";

  let amount: number | null = parseNumberField(raw.amount);
  if (amount != null) {
    if (amount < 0 || amount > 1_000_000_000) amount = null;
    else amount = Math.round(amount * 100) / 100;
  }

  let fee_amount: number | null = parseNumberField(raw.fee_amount);
  if (fee_amount != null) {
    if (fee_amount < 0 || fee_amount > 1_000_000_000) fee_amount = null;
    else fee_amount = Math.round(fee_amount * 100) / 100;
  }

  let date: string | null =
    typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date.trim())
      ? raw.date.trim()
      : null;

  const currency =
    typeof raw.currency === "string" && /^[A-Z]{3}$/i.test(raw.currency.trim())
      ? raw.currency.trim().toUpperCase()
      : null;

  let merchant =
    typeof raw.merchant === "string" ? raw.merchant.replace(/\s+/g, " ").trim().slice(0, 200) : null;
  if (merchant === "") merchant = null;

  const category_hint =
    typeof raw.category_hint === "string"
      ? raw.category_hint.replace(/\s+/g, " ").trim().slice(0, 120) || null
      : null;

  let description =
    typeof raw.description === "string"
      ? raw.description.replace(/\s+/g, " ").trim().slice(0, 200) || null
      : null;

  return {
    type,
    amount,
    date,
    currency,
    merchant,
    category_hint,
    description,
    fee_amount,
  };
}
type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function toAnthropicMediaType(mime: string): SupportedMediaType {
  if (mime === "image/jpg") return "image/jpeg";
  return mime as SupportedMediaType;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  if (!isSupportedImageType(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Please use JPEG, PNG, or WebP." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = toAnthropicMediaType(file.type);

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;
  let attachment_url: string | null = null;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (!uploadError) {
    const { data: urlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(storagePath);
    attachment_url = urlData.publicUrl ?? null;
  }
  // Upload failure is non-fatal — we still parse the receipt.

  // ── Parse with Claude Vision ────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      {
        error: "Receipt scanning requires ANTHROPIC_API_KEY. Add it to your environment variables.",
        attachment_url,
      },
      { status: 503 }
    );
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  let parsed: ParsedReceipt;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `You are reading ONE retail / restaurant receipt image. Extract fields for a personal finance app.

Return ONLY a single JSON object (no markdown, no commentary):

{
  "type": "expense" | "credit_charge" | "income",
  "amount": <number or null>,
  "date": "<YYYY-MM-DD or null>",
  "currency": "<3-letter ISO code or null>",
  "merchant": "<short business / store name or null>",
  "category_hint": "<one of: Food & Dining, Transport, Shopping, Healthcare, Utilities, Entertainment, Education, Travel, Personal Care, or null>",
  "description": "<brief item summary, max 80 chars, or null>",
  "fee_amount": <number or null>
}

Strict rules:
- **amount** = the final **AMOUNT DUE / TOTAL / GRAND TOTAL** the customer pays (after tax, after discounts). NEVER use: subtotal before tax, line-item prices, unit price × qty, "Tender", "Change", "Cash", VAT-only lines, or payment-method totals unless that is the only total shown.
- If you see both a subtotal and a clearly labeled **TOTAL**, use **TOTAL** only.
- **merchant** = the **store or brand name** (e.g. sign above items, logo text). NOT: street address alone, phone number, cashier name, "Thank you", terminal ID, or website URL unless that is the only business name visible.
- **type**: use "credit_charge" only if the receipt clearly shows card / credit payment as the transaction; use "expense" for cash, debit, QR, or unclear. Use "income" only if this is clearly money **received by** the customer (refund to card, rebate)—not a normal purchase.
- **fee_amount**: only service charge / tip / convenience fee shown **separate from** the main total; else null.
- Use null (not 0) when unreadable.
- **currency**: infer from currency symbol or text (e.g. PHP, USD); else null.`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in model response");
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    parsed = coerceParsedReceipt(raw);
  } catch {
    return NextResponse.json(
      {
        error: "Could not read the receipt. Please try a clearer, well-lit photo.",
        attachment_url,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ parsed, attachment_url });
}
