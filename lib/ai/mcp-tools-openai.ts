import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/** OpenRouter / OpenAI chat completions `tools` array shape. */
export type OpenAiCompatibleTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export function mcpToolsToOpenAiCompatibleTools(tools: Tool[]): OpenAiCompatibleTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      ...(t.description !== undefined ? { description: t.description } : {}),
      parameters: t.input_schema as unknown as Record<string, unknown>,
    },
  }));
}
