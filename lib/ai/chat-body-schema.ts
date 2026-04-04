import { z } from "zod";

/** Validates `/api/ai/chat` POST JSON — matches Anthropic-style message shape loosely. */
export const chatPostBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.unknown(),
      })
    )
    .min(1)
    .max(100),
});

export type ChatPostBody = z.infer<typeof chatPostBodySchema>;
