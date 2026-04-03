import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { handleMCPTool } from "@/lib/mcp/handlers";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { isProSubscriber } from "@/lib/subscription-access";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const { messages: clientMessages } = body as { messages: MessageParam[] };

  const [{ data: profile }, { data: promptSettings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("base_currency, display_name, plan, plan_expires_at")
      .eq("id", user.id)
      .single(),
    supabase.from("prompt_settings").select("*").eq("user_id", user.id).single(),
  ]);

  if (!isProSubscriber(profile)) {
    return new Response(
      JSON.stringify({ error: "Pro subscription required for AI chat." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = buildSystemPrompt({
    baseCurrency: profile?.base_currency ?? "PHP",
    userDisplayName: profile?.display_name ?? user.email?.split("@")[0],
    systemPromptPrefix: promptSettings?.system_prompt_prefix ?? undefined,
    aiPersonality: promptSettings?.ai_personality ?? "professional",
    responseLanguage: promptSettings?.response_language ?? "en",
  });

  // Agentic loop — keep calling Claude until no more tool calls
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages: MessageParam[] = [...clientMessages];
        let continueLoop = true;

        while (continueLoop) {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            tools: MCP_TOOLS,
            messages: currentMessages,
            stream: false,
          });

          if (response.stop_reason === "tool_use") {
            // Collect all text so far
            const textContent = response.content.filter((b) => b.type === "text");
            if (textContent.length > 0) {
              const textBlock = textContent[0];
              if (textBlock.type === "text") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "text", text: textBlock.text })}\n\n`)
                );
              }
            }

            // Execute all tool calls
            const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
            const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

            for (const block of toolUseBlocks) {
              if (block.type !== "tool_use") continue;

              // Notify client of tool activity
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool_start",
                    tool: block.name,
                    tool_id: block.id,
                  })}\n\n`
                )
              );

              const result = await handleMCPTool(
                block.name,
                block.input as Record<string, unknown>,
                user.id
              );

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool_end",
                    tool: block.name,
                    tool_id: block.id,
                  })}\n\n`
                )
              );

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            }

            // Add assistant message and tool results to continue loop
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: response.content },
              { role: "user", content: toolResults },
            ];
          } else {
            // Final response — stream text
            const finalText = response.content
              .filter((b) => b.type === "text")
              .map((b) => (b.type === "text" ? b.text : ""))
              .join("");

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", text: finalText })}\n\n`)
            );
            continueLoop = false;

            // Persist to DB
            await supabase.from("ai_chat_messages").insert([
              {
                user_id: user.id,
                role: "user",
                content: (clientMessages[clientMessages.length - 1] as MessageParam & { content: string }).content,
              },
              {
                user_id: user.id,
                role: "assistant",
                content: finalText,
              },
            ]);
          }
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
