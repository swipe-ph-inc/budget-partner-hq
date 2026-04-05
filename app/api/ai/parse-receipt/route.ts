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

  if (!SUPPORTED_TYPES.includes(file.type as any)) {
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
              text: `Analyze this receipt image and extract transaction details.
Return ONLY a valid JSON object — no other text:

{
  "type": "expense" | "credit_charge" | "income",
  "amount": <number or null>,
  "date": "<YYYY-MM-DD or null>",
  "currency": "<3-letter ISO code or null>",
  "merchant": "<store/vendor name or null>",
  "category_hint": "<one of: Food & Dining, Transport, Shopping, Healthcare, Utilities, Entertainment, Education, Travel, Personal Care, or null>",
  "description": "<brief summary of items, max 80 chars, or null>",
  "fee_amount": <service charge / tip shown separately, number or null>
}

Rules:
- type = "credit_charge" if a card was charged, "expense" if cash/debit, "income" if payment received
- amount = the GRAND TOTAL paid (including tax), not the subtotal
- Return null for any field you cannot read clearly from the image`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in model response");
    parsed = JSON.parse(jsonMatch[0]);
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
