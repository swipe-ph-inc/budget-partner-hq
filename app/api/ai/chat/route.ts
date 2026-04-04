import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, interpolateSystemPrompt } from "@/lib/ai/system-prompt";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { isProSubscriber } from "@/lib/subscription-access";
import { runAnthropicAgenticLoop } from "@/lib/ai/anthropic-chat";
import { runOpenRouterAgenticLoop } from "@/lib/ai/openrouter-chat";
import {
  getOpenRouterApiKey,
  getOpenRouterChatCompletionsUrl,
} from "@/lib/ai/ai-provider-config";
import { assertModelMatchesProvider, resolveUserLlm } from "@/lib/ai/resolve-user-llm";
import { chatPostBodySchema } from "@/lib/ai/chat-body-schema";
import { rateLimitAiChat } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const rate = await rateLimitAiChat(user.id);
  if (!rate.success) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "3600" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = chatPostBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid messages.", details: parsed.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const clientMessages = parsed.data.messages as MessageParam[];

  const [{ data: profile }, { data: systemPromptRow }, { data: assistantPrimerRow }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("base_currency, display_name, plan, plan_expires_at, ai_personality, response_language, system_prompt_prefix, ai_provider, ai_model")
        .eq("id", user.id)
        .single(),
      supabase
        .from("system_prompts")
        .select("content")
        .eq("is_active", true)
        .eq("name", "default")
        .single(),
      supabase
        .from("system_prompts")
        .select("content")
        .eq("is_active", true)
        .eq("name", "assistant_primer")
        .single(),
    ]);

  if (!isProSubscriber(profile)) {
    return new Response(
      JSON.stringify({ error: "Pro subscription required for AI chat." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  let provider: ReturnType<typeof resolveUserLlm>["provider"];
  let model: string;
  try {
    const resolved = resolveUserLlm(profile);
    provider = resolved.provider;
    model = resolved.model;
    assertModelMatchesProvider(provider, model);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid AI model configuration.";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (provider === "openrouter") {
    if (!getOpenRouterApiKey()) {
      return new Response(
        JSON.stringify({
          error:
            "OpenRouter is not configured on the server. Add OPEN_ROUTER_API_KEY (or OPENROUTER_API_KEY), or choose Anthropic in AI Settings if your workspace uses direct Claude.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Anthropic API is not configured. Add ANTHROPIC_API_KEY, or choose OpenRouter in AI Settings.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const promptOptions = {
    baseCurrency: profile?.base_currency ?? "PHP",
    userDisplayName: profile?.display_name ?? user.email?.split("@")[0],
    aiPersonality: profile?.ai_personality ?? "professional",
    responseLanguage: profile?.response_language ?? "en",
  };

  const baseSystemPrompt = systemPromptRow?.content
    ? interpolateSystemPrompt(systemPromptRow.content, promptOptions)
    : buildSystemPrompt(promptOptions);

  const systemPrompt = `${baseSystemPrompt}

Tool usage (required): For balances, transactions, accounts, credit cards, debts, invoices, savings, allocations, safe-to-spend, or any user-specific data, you MUST call the appropriate tools — never invent or estimate numbers. Prefer tools over assumptions.`;

  // ── Build the message list with primer + optional user instructions ──────
  // Level 1 (System prompt): injected via `system` param above — admin only.
  // Level 2 (Assistant primer): simulated assistant exchange — hard guardrails.
  // Level 3 (User prompt): user's personal instructions — lowest authority.

  const primerContent = assistantPrimerRow?.content;
  const userInstructions = profile?.system_prompt_prefix?.trim();

  const primerMessages: MessageParam[] = primerContent
    ? [
        { role: "user", content: "Please confirm your role and operational guidelines." },
        { role: "assistant", content: primerContent },
      ]
    : [];

  const userInstructionMessages: MessageParam[] = userInstructions
    ? [
        {
          role: "user",
          content: `Before we start, here are my personal preferences for our conversation:\n\n${userInstructions}`,
        },
        {
          role: "assistant",
          content: "Understood. I'll keep those preferences in mind throughout our conversation.",
        },
      ]
    : [];

  const messagesForApi: MessageParam[] = [
    ...primerMessages,
    ...userInstructionMessages,
    ...clientMessages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const emit = (
          event:
            | { type: "text"; text: string }
            | { type: "tool_start"; tool: string; tool_id: string }
            | { type: "tool_end"; tool: string; tool_id: string }
        ) => {
          if (event.type === "text") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", text: event.text })}\n\n`)
            );
          } else if (event.type === "tool_start") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_start",
                  tool: event.tool,
                  tool_id: event.tool_id,
                })}\n\n`
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_end",
                  tool: event.tool,
                  tool_id: event.tool_id,
                })}\n\n`
              )
            );
          }
        };

        let finalText = "";

        if (provider === "openrouter") {
          finalText = await runOpenRouterAgenticLoop({
            baseUrl: getOpenRouterChatCompletionsUrl(),
            apiKey: getOpenRouterApiKey()!,
            model,
            systemPrompt,
            clientMessages: messagesForApi,
            userId: user.id,
            emit,
            httpReferer: process.env.NEXT_PUBLIC_APP_URL,
          });
        } else {
          const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY!,
          });
          finalText = await runAnthropicAgenticLoop({
            client: anthropic,
            model,
            systemPrompt,
            clientMessages: messagesForApi,
            userId: user.id,
            emit,
          });
        }

        try {
          const lastUser = clientMessages[clientMessages.length - 1];
          const userContent =
            typeof lastUser?.content === "string"
              ? lastUser.content
              : JSON.stringify(lastUser?.content ?? "");
          await supabase.from("ai_chat_messages").insert([
            { user_id: user.id, role: "user", content: userContent },
            { user_id: user.id, role: "assistant", content: finalText },
          ]);
        } catch {
          // Chat reply was already streamed; persistence is best-effort
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
