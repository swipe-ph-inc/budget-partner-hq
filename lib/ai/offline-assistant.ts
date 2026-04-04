/**
 * Local, deterministic replies when the app cannot reach the Anthropic API.
 * No account data — general budgeting guidance only.
 */

function norm(s: string): string {
  return s.toLowerCase().trim();
}

const OFFLINE_FOOTER =
  "\n\n— Offline mode: general tips only. Reconnect for live AI with access to your Budget Partner data and tools.";

export function getOfflineAssistantReply(userMessage: string): string {
  const q = norm(userMessage);

  if (!q) {
    return `Ask me anything about budgeting. When you’re back online, I can use your real balances and transactions.${OFFLINE_FOOTER}`;
  }

  if (/(debt|loan|owe|payoff|minimum payment|apr|interest)/.test(q)) {
    return `For debt: list balances, interest rates, and minimums. Pay extra toward the highest-rate debt first (avalanche) or the smallest balance first (snowball) — pick the one you’ll stick with. Avoid new charges on cards you’re paying down.${OFFLINE_FOOTER}`;
  }

  if (/(save|savings|emergency fund|buffer)/.test(q)) {
    return `Start with a small emergency fund (e.g. one month of essentials), then increase over time. Automate a transfer on payday so you don’t have to decide each month.${OFFLINE_FOOTER}`;
  }

  if (/(budget|allocate|50\/30\/20|spending plan)/.test(q)) {
    return `A simple structure: assign every unit of income to bills, savings, or spending before the month starts. Track what you actually spend and adjust next month — the goal is awareness, not perfection.${OFFLINE_FOOTER}`;
  }

  if (/(safe.?to.?spend|can i afford|afford)/.test(q)) {
    return `“Safe to spend” usually means: money left after bills, savings goals, and upcoming known expenses. Offline I can’t see your accounts — when online, Budget Partner can compute this from your data.${OFFLINE_FOOTER}`;
  }

  if (/(track|expense|categor|transaction|receipt)/.test(q)) {
    return `Log expenses as you go (even weekly batches help). Consistent categories make reports meaningful. Reconnect to log transactions through the app’s AI tools.${OFFLINE_FOOTER}`;
  }

  if (/(bill|due|subscription|recurring)/.test(q)) {
    return `List fixed bills and due dates on a calendar. Review subscriptions quarterly — cancel what you don’t use.${OFFLINE_FOOTER}`;
  }

  if (/(invest|stock|etf|retire)/.test(q)) {
    return `Before investing beyond a match at work, many people shore up emergency savings and high-interest debt. This isn’t personalised advice — when online, ask for help in context of your goals.${OFFLINE_FOOTER}`;
  }

  if (/(hello|hi\b|hey|help)/.test(q)) {
    return `Hi — I’m running offline with built-in tips. Ask about budgeting, debt, savings, or spending habits. For answers tied to your own data, reconnect to the internet.${OFFLINE_FOOTER}`;
  }

  return `I’m offline, so I can’t read your accounts or run tools. Try asking about budgeting basics, debt strategies, or savings habits — or reconnect for full AI.${OFFLINE_FOOTER}`;
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  if (m.includes("failed to fetch") || m.includes("networkerror")) return true;
  if (m.includes("load failed") || m.includes("network request failed")) return true;
  return false;
}
