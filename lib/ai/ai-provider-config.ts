/** Which backend serves `/api/ai/chat`. Default: OpenRouter (experiment). */
export type AiProviderId = "openrouter" | "anthropic";

export function getAiProvider(): AiProviderId {
  const v = (process.env.AI_PROVIDER ?? "openrouter").trim().toLowerCase();
  if (v === "anthropic" || v === "openrouter") return v;
  return "openrouter";
}

export function getOpenRouterApiKey(): string | undefined {
  return (
    process.env.OPEN_ROUTER_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    undefined
  );
}

export function getOpenRouterModel(): string {
  return (
    process.env.OPEN_ROUTER_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    "openai/gpt-4o-mini"
  );
}

export function getOpenRouterChatCompletionsUrl(): string {
  return (
    process.env.OPEN_ROUTER_BASE_URL?.trim() ||
    process.env.OPENROUTER_BASE_URL?.trim() ||
    "https://openrouter.ai/api/v1/chat/completions"
  );
}

export function getAnthropicChatModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";
}
