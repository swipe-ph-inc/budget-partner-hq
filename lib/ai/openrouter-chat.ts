import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { mcpToolsToOpenAiCompatibleTools } from "@/lib/ai/mcp-tools-openai";
import { handleMCPTool } from "@/lib/mcp/handlers";
import type { ChatSSEmitter } from "@/lib/ai/anthropic-chat";

const OPENROUTER_DEFAULT_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

function clientMessagesToOpenAi(messages: MessageParam[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content =
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? JSON.stringify(m.content)
          : String(m.content ?? "");
    out.push({ role: m.role, content });
  }
  return out;
}

export async function runOpenRouterAgenticLoop(params: {
  baseUrl?: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  clientMessages: MessageParam[];
  userId: string;
  emit: ChatSSEmitter;
  /** Optional site URL for OpenRouter rankings / attribution */
  httpReferer?: string;
}): Promise<string> {
  const {
    baseUrl = OPENROUTER_DEFAULT_URL,
    apiKey,
    model,
    systemPrompt,
    clientMessages,
    userId,
    emit,
    httpReferer,
  } = params;

  const tools = mcpToolsToOpenAiCompatibleTools(MCP_TOOLS);

  const messages: OpenAiMessage[] = [
    { role: "system", content: systemPrompt },
    ...clientMessagesToOpenAi(clientMessages),
  ];

  const maxRounds = 24;
  let finalText = "";

  for (let round = 0; round < maxRounds; round++) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "Budget Partner HQ",
    };
    if (httpReferer?.trim()) {
      headers["HTTP-Referer"] = httpReferer.trim();
    }

    const res = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 4096,
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      let detail = raw;
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } };
        if (j.error?.message) detail = j.error.message;
      } catch {
        /* keep raw */
      }
      throw new Error(detail || `OpenRouter request failed (${res.status})`);
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: OpenAiMessage["tool_calls"];
        };
      }>;
    };

    const choice = data.choices?.[0]?.message;
    if (!choice) {
      throw new Error("No response from OpenRouter");
    }

    const toolCalls = choice.tool_calls?.filter((tc) => tc.type === "function") ?? [];

    if (toolCalls.length > 0) {
      if (choice.content) {
        emit({ type: "text", text: choice.content });
      }

      const toolMessages: OpenAiMessage[] = [];

      for (const tc of toolCalls) {
        const name = tc.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }

        emit({ type: "tool_start", tool: name, tool_id: tc.id });

        const result = await handleMCPTool(name, args, userId);

        emit({ type: "tool_end", tool: name, tool_id: tc.id });

        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      });
      messages.push(...toolMessages);
      continue;
    }

    finalText = choice.content ?? "";
    emit({ type: "text", text: finalText });
    return finalText;
  }

  throw new Error("Too many tool rounds — try a narrower question.");
}
