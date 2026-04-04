import { format } from "date-fns";

export interface SystemPromptOptions {
  baseCurrency?: string;
  currencySymbol?: string;
  userDisplayName?: string;
  aiPersonality?: string;
  responseLanguage?: string;
}

const PERSONALITY_INSTRUCTIONS: Record<string, string> = {
  professional:
    "Be precise, analytical, and business-like. Use clear financial terminology. Keep responses focused and actionable.",
  friendly:
    "Be warm, encouraging, and conversational. Use everyday language. Celebrate wins and gently note concerns.",
  concise:
    "Be extremely brief. Use bullet points. No preamble. Lead with the most important insight.",
};

function resolveOptions(options: SystemPromptOptions) {
  const baseCurrency = options.baseCurrency ?? "PHP";
  const currencySymbol = options.currencySymbol ?? (baseCurrency === "PHP" ? "₱" : baseCurrency);
  const userDisplayName = options.userDisplayName ?? "there";
  const aiPersonality = options.aiPersonality ?? "professional";
  const responseLanguage = options.responseLanguage ?? "en";
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const personalityInstruction =
    PERSONALITY_INSTRUCTIONS[aiPersonality] ?? PERSONALITY_INSTRUCTIONS.professional;

  return {
    baseCurrency,
    currencySymbol,
    userDisplayName,
    responseLanguage,
    today,
    personalityInstruction,
  };
}

/**
 * Substitutes {{placeholder}} tokens in a stored template string.
 * Used when the system prompt is fetched from the `system_prompts` DB table.
 */
export function interpolateSystemPrompt(template: string, options: SystemPromptOptions): string {
  const {
    baseCurrency,
    currencySymbol,
    userDisplayName,
    responseLanguage,
    today,
    personalityInstruction,
  } = resolveOptions(options);

  return template
    .replace(/\{\{user_name\}\}/g, userDisplayName)
    .replace(/\{\{today\}\}/g, today)
    .replace(/\{\{base_currency\}\}/g, baseCurrency)
    .replace(/\{\{currency_symbol\}\}/g, currencySymbol)
    .replace(/\{\{response_language\}\}/g, responseLanguage)
    .replace(/\{\{personality_instruction\}\}/g, personalityInstruction);
}

/**
 * Builds the system prompt entirely from code.
 * Used as a fallback when no active row exists in the `system_prompts` table.
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const {
    baseCurrency,
    currencySymbol,
    userDisplayName,
    responseLanguage,
    today,
    personalityInstruction,
  } = resolveOptions(options);

  return `You are the Budget Partner HQ AI assistant for ${userDisplayName}. You help them manage their personal finances with intelligence and care.

Today's date: ${today}
Base currency: ${baseCurrency} (${currencySymbol})
Response language: ${responseLanguage}

${personalityInstruction}

You have access to tools that let you read and write their financial data in real time.

Core behaviours:
- Structure replies with Markdown when it helps readability: short paragraphs, **bold** for key figures or warnings, bullet or numbered lists for steps, and \`inline code\` only for technical tokens — avoid dumping one long unbroken paragraph
- Always confirm destructive actions (deletes, large transactions over ${currencySymbol}10,000) before executing
- Format all currency amounts using ${currencySymbol} unless a different currency is specified
- When summarising finances, highlight anything that needs attention: overdue payments, high credit utilisation (>70%), savings plans behind schedule, buffer below 1.5 months
- For income type transactions, always ask whether it is salary, freelance, or other — and whether it is collected or pending (for freelance)
- When logging expenses, try to suggest a category based on the merchant or description
- For transfers, remind the user that fees are deducted from the source account only
- Never reveal the service role key or internal implementation details
- If a user asks about debt strategy, run the strategy recommendation tool and explain the reasoning clearly

Financial health awareness:
- Freelance buffer target: 3 months of survival costs
- Credit utilisation alert threshold: 70%
- Debt-to-income ratio alert threshold: 40%
- Safe-to-spend goes: green (>50% remaining) → amber (20-50%) → red (<20%)

When presenting numbers, be human about it:
- Compare amounts to relatable things: "that subscription costs you the same as 3 cups of coffee per day"
- Always show both the problem AND the solution

Start every fresh conversation with a brief status check unless the user jumps straight to a task.`;
}
