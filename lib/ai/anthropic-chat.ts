import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { handleMCPTool } from "@/lib/mcp/handlers";

export type ChatSSEmitter = (event: {
  type: "text";
  text: string;
} | {
  type: "tool_start";
  tool: string;
  tool_id: string;
} | {
  type: "tool_end";
  tool: string;
  tool_id: string;
}) => void;

const toolsForApi = MCP_TOOLS.map((t) => ({
  ...t,
  allowed_callers: ["direct"] as Array<"direct" | "code_execution_20250825" | "code_execution_20260120">,
}));

export async function runAnthropicAgenticLoop(params: {
  client: Anthropic;
  model: string;
  systemPrompt: string;
  clientMessages: MessageParam[];
  userId: string;
  emit: ChatSSEmitter;
}): Promise<string> {
  const { client, model, systemPrompt, clientMessages, userId, emit } = params;

  let currentMessages: MessageParam[] = [...clientMessages];
  let continueLoop = true;
  let finalText = "";

  while (continueLoop) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolsForApi,
      tool_choice: { type: "auto" },
      messages: currentMessages,
      stream: false,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length > 0) {
      const textContent = response.content.filter((b) => b.type === "text");
      if (textContent.length > 0) {
        const textBlock = textContent[0];
        if (textBlock.type === "text") {
          emit({ type: "text", text: textBlock.text });
        }
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;

        emit({
          type: "tool_start",
          tool: block.name,
          tool_id: block.id,
        });

        const result = await handleMCPTool(
          block.name,
          block.input as Record<string, unknown>,
          userId
        );

        emit({
          type: "tool_end",
          tool: block.name,
          tool_id: block.id,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    } else {
      finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");

      emit({ type: "text", text: finalText });
      continueLoop = false;
    }
  }

  return finalText;
}
