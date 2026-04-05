"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Bot, X, Send, Loader2, ChevronDown, Sparkles, Lock, WifiOff, RotateCcw, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOfflineAssistantReply, isLikelyNetworkError } from "@/lib/ai/offline-assistant";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { AssistantMessageContent } from "@/components/chat/assistant-message-content";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolActivity?: Array<{ tool: string; done: boolean }>;
  /** Set when the assistant reply failed (provider/network); enables retry / restore to input */
  isError?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  get_accounts: "Reading accounts…",
  get_transactions: "Loading transactions…",
  create_transaction: "Recording transaction…",
  get_credit_cards: "Checking credit cards…",
  get_dashboard_summary: "Fetching financial summary…",
  get_financial_health_snapshot: "Analysing health metrics…",
  get_monthly_allocation: "Loading allocation plan…",
  get_safe_to_spend: "Calculating safe-to-spend…",
  get_debt_strategy: "Loading debt strategy…",
  run_strategy_recommendation: "Running strategy analysis…",
  get_savings_plans: "Checking savings goals…",
  get_upcoming_due_dates: "Checking due dates…",
  get_spending_by_category: "Analysing spending…",
  get_invoices: "Loading invoices…",
  get_subscriptions: "Loading subscriptions…",
  get_debts: "Loading debt ledger…",
  get_windfall_recommendation: "Calculating windfall split…",
};

export function AIChatButton({ aiEnabled }: { aiEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const online = useOnlineStatus();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const lastErrorAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.isError) return m.id;
    }
    return null;
  }, [messages]);

  const sendChatWithMessages = useCallback(
    async (
      apiMessages: Array<{ role: string; content: string }>,
      assistantMsg: Message,
      userPromptForOffline: string
    ) => {
      const deliverOfflineReply = async () => {
        await new Promise((r) => setTimeout(r, 120));
        const text = getOfflineAssistantReply(userPromptForOffline);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: text } : m))
        );
      };

      if (aiEnabled && !online) {
        await deliverOfflineReply();
        return;
      }

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) {
          const raw = await res.text();
          let detail = `Request failed (${res.status})`;
          try {
            const errBody = JSON.parse(raw) as { error?: string };
            if (typeof errBody.error === "string" && errBody.error.trim()) {
              detail = errBody.error.trim();
            }
          } catch {
            if (raw.trim()) detail = raw.trim();
          }
          throw new Error(detail);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        sseRead: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break sseRead;

            try {
              const event = JSON.parse(payload) as {
                type: string;
                text?: string;
                message?: string;
                tool?: string;
                tool_id?: string;
              };

              if (event.type === "error") {
                const errText =
                  typeof event.message === "string" && event.message.trim()
                    ? event.message.trim()
                    : "Something went wrong.";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: errText, isError: true, toolActivity: [] }
                      : m
                  )
                );
                break sseRead;
              }

              if (event.type === "text" && event.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + event.text! }
                      : m
                  )
                );
              } else if (event.type === "tool_start" && event.tool) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolActivity: [
                            ...(m.toolActivity ?? []),
                            { tool: event.tool!, done: false },
                          ],
                        }
                      : m
                  )
                );
              } else if (event.type === "tool_end" && event.tool) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolActivity: (m.toolActivity ?? []).map((ta) =>
                            ta.tool === event.tool ? { ...ta, done: true } : ta
                          ),
                        }
                      : m
                  )
                );
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (err) {
        if (aiEnabled && isLikelyNetworkError(err)) {
          await deliverOfflineReply();
          return;
        }
        const fallback = "Sorry, I encountered an error. Please try again.";
        const message = err instanceof Error && err.message.trim() ? err.message.trim() : fallback;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: message, isError: true, toolActivity: [] }
              : m
          )
        );
      }
    },
    [aiEnabled, online]
  );

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      toolActivity: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await sendChatWithMessages(apiMessages, assistantMsg, userMsg.content);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, sendChatWithMessages]);

  const retryLastFailed = useCallback(async () => {
    if (loading) return;

    const holder: {
      payload: {
        apiMessages: Array<{ role: string; content: string }>;
        newAssistant: Message;
        userPrompt: string;
      } | null;
    } = { payload: null };

    setMessages((current) => {
      const errorIdx = current.findLastIndex((m) => m.role === "assistant" && m.isError);
      if (errorIdx < 1) return current;
      const prevUser = current[errorIdx - 1];
      if (prevUser.role !== "user") return current;

      const newAssistant: Message = {
        id: `${Date.now()}-retry`,
        role: "assistant",
        content: "",
        toolActivity: [],
      };

      holder.payload = {
        apiMessages: current.slice(0, errorIdx).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        newAssistant,
        userPrompt: prevUser.content,
      };
      return [...current.slice(0, errorIdx), newAssistant];
    });

    const { payload } = holder;
    if (!payload) return;

    setLoading(true);
    try {
      await sendChatWithMessages(payload.apiMessages, payload.newAssistant, payload.userPrompt);
    } finally {
      setLoading(false);
    }
  }, [loading, sendChatWithMessages]);

  const restoreFailedPromptToInput = useCallback(() => {
    let text: string | null = null;
    setMessages((current) => {
      const errorIdx = current.findLastIndex((m) => m.role === "assistant" && m.isError);
      if (errorIdx < 1) return current;
      const prevUser = current[errorIdx - 1];
      if (prevUser.role !== "user") return current;
      text = prevUser.content;
      return current.filter((_, i) => i !== errorIdx);
    });
    if (text !== null) {
      setInput(text);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Chat panel — Pro only full chat; free tier sees upgrade message */}
      {open && (
        <div
          className="fixed bottom-24 right-3 z-50 flex h-[min(720px,calc(100vh-6rem))] w-[calc(100vw-1.5rem)] max-w-[540px] flex-col sm:right-6"
          style={{
            animation: "slideUp 0.3s ease-out",
          }}
        >
          <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card shadow-float overflow-hidden">
            {!aiEnabled ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Budget Partner AI is a Pro feature</p>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Upgrade to Pro to chat with your finances, run tools, and get personalised guidance.
                  </p>
                </div>
                <Button asChild className="w-full max-w-xs">
                  <Link href="/pricing">View plans &amp; upgrade</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-primary text-white shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Budget Partner AI</div>
                <div className="text-white/60 text-xs">
                  {loading ? "Thinking…" : online ? "Ready to help" : "Offline tips"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!online && (
              <div
                className="flex shrink-0 items-start gap-2 border-b border-border bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
                role="status"
              >
                <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  You&apos;re offline. You&apos;ll get general budgeting tips only — reconnect for live AI and your
                  account data.
                </span>
              </div>
            )}

            {/* Messages — flex-1 + min-h-0 keeps a fixed panel height; thread scrolls inside */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Hi, I&apos;m your Budget Partner
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Ask me about your finances, log transactions, check due
                      dates, or get debt payoff advice.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {[
                      "What's my safe-to-spend?",
                      "How's my credit utilisation?",
                      "Show my debt strategy",
                      "Log a ₱500 expense",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="text-xs text-left px-3 py-2 rounded-lg bg-secondary hover:bg-muted border border-border transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 max-w-[85%]">
                    {/* Tool activity */}
                    {msg.toolActivity && msg.toolActivity.length > 0 && (
                      <div className="space-y-1">
                        {msg.toolActivity.map((ta, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border",
                              ta.done
                                ? "bg-success/10 border-success/20 text-success-700"
                                : "bg-secondary border-border text-muted-foreground"
                            )}
                          >
                            {!ta.done && (
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                            )}
                            {ta.done && (
                              <span className="text-success-600">✓</span>
                            )}
                            {TOOL_LABELS[ta.tool] ?? ta.tool}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message bubble */}
                    {(msg.role === "user" ||
                      msg.content ||
                      (loading && msg.role === "assistant")) && (
                      <div
                        className={cn(
                          "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-primary text-white"
                            : msg.isError
                              ? "bg-destructive/10 text-foreground border border-destructive/25"
                              : "bg-secondary text-foreground"
                        )}
                      >
                        {msg.role === "user" ? (
                          <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                        ) : msg.content ? (
                          <AssistantMessageContent content={msg.content} />
                        ) : loading ? (
                          <div className="flex gap-1 items-center">
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        ) : null}
                      </div>
                    )}

                    {msg.role === "assistant" &&
                      msg.isError &&
                      msg.id === lastErrorAssistantId && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            disabled={loading}
                            onClick={() => void retryLastFailed()}
                            aria-label="Retry the same request"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            Retry
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            disabled={loading}
                            onClick={restoreFailedPromptToInput}
                            aria-label="Put your message back in the input field to edit or resend"
                          >
                            <PencilLine className="h-3.5 w-3.5" aria-hidden />
                            Edit in input
                          </Button>
                        </div>
                      )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your finances…"
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[36px] max-h-[120px]"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="shrink-0 h-9 w-9"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-float transition-all duration-200 sm:bottom-6 sm:right-6",
          "bg-primary text-white hover:bg-primary-800 active:scale-95",
          open && "rotate-12"
        )}
        aria-label={aiEnabled ? "Open AI assistant" : "AI assistant (Pro required)"}
      >
        {open ? (
          <ChevronDown className="h-6 w-6" />
        ) : !aiEnabled ? (
          <Lock className="h-5 w-5" aria-hidden />
        ) : (
          <Sparkles className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
