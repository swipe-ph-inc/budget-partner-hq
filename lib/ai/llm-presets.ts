/** Curated models for AI Settings — OpenRouter uses provider/model ids. */
export const OPENROUTER_MODEL_PRESETS: { id: string; label: string }[] = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku (OpenRouter)" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (OpenRouter)" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
];

/** Direct Anthropic API model ids (no slash). */
export const ANTHROPIC_MODEL_PRESETS: { id: string; label: string }[] = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];
