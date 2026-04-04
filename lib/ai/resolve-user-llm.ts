import type { AiProviderId } from "@/lib/ai/ai-provider-config";
import {
  getAiProvider,
  getAnthropicChatModel,
  getOpenRouterModel,
} from "@/lib/ai/ai-provider-config";

export type PromptSettingsLlmSlice = {
  ai_provider: string | null;
  ai_model: string | null;
} | null;

/**
 * Resolves which provider and model id to use for /api/ai/chat.
 * User overrides in prompt_settings; null columns fall back to env defaults.
 */
export function resolveUserLlm(promptSettings: PromptSettingsLlmSlice): {
  provider: AiProviderId;
  model: string;
} {
  const envDefault = getAiProvider();
  const userProv = promptSettings?.ai_provider?.trim();
  const provider: AiProviderId =
    userProv === "openrouter" || userProv === "anthropic" ? userProv : envDefault;

  const userModel = promptSettings?.ai_model?.trim();
  if (userModel) {
    return { provider, model: userModel };
  }

  return {
    provider,
    model: provider === "openrouter" ? getOpenRouterModel() : getAnthropicChatModel(),
  };
}

/** Reject obviously mismatched model ids to avoid cryptic upstream errors. */
export function assertModelMatchesProvider(provider: AiProviderId, model: string): void {
  const m = model.trim();
  if (!m) {
    throw new Error("Model id is empty.");
  }
  if (m.length > 200) {
    throw new Error("Model id is too long.");
  }
  if (provider === "anthropic" && m.includes("/")) {
    throw new Error(
      "This model looks like an OpenRouter id (contains '/'). Set provider to OpenRouter in AI Settings, or use a direct Claude id (e.g. claude-haiku-4-5)."
    );
  }
}
