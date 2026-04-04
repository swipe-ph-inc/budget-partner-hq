import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let aiChatLimiter: Ratelimit | null = null;

function getAiChatLimiter(): Ratelimit | null {
  if (aiChatLimiter) return aiChatLimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  aiChatLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(40, "1 h"),
    prefix: "ratelimit:ai-chat",
    analytics: true,
  });
  return aiChatLimiter;
}

/**
 * Per-user sliding window for `/api/ai/chat`. When Upstash env is unset, allows all
 * traffic (useful for local dev); production should set REST URL + token.
 */
export async function rateLimitAiChat(userId: string): Promise<{ success: boolean; remaining?: number }> {
  const limiter = getAiChatLimiter();
  if (!limiter) {
    return { success: true };
  }
  const { success, remaining } = await limiter.limit(userId);
  return { success, remaining };
}
