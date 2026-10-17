"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  mode?: "model" | "simulated";
};

export function AiMentor({
  lessonId,
  lessonTitle,
  conceptName,
  activeSceneTitle,
  activeSceneRole,
  selectedEntity = null,
  visibleLogs = null,
  onMentorOpen,
  onMentorAction,
  onMentorReply,
}: {
  lessonId: string;
  lessonTitle: string;
  conceptName: string;
  activeSceneTitle: string;
  activeSceneRole: string;
  selectedEntity?: string | null;
  visibleLogs?: string | null;
  onMentorOpen?: (sceneTitle: string) => void;
  onMentorAction?: (action: "explain" | "hint" | "deep-dive", promptCategory?: string) => void;
  onMentorReply?: (action: string, status: "success" | "fallback") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I am your AI Learning Mentor for "${lessonTitle}". Ask me anything about ${activeSceneTitle}, or use the quick action chips below for guided explanations and hints.`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isPending, setIsPending] = useState(false);

  function handleToggleOpen() {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) onMentorOpen?.(activeSceneTitle);
      return next;
    });
  }

  async function sendAction(
    action: "explain" | "simplify" | "hint" | "explain_logs" | "example" | "quiz_me" | "freeform",
    userText?: string,
  ) {
    const textToSend = userText ?? actionLabel(action);
    const newHistory: Message[] = [...messages, { role: "user", content: textToSend }];
    setMessages(newHistory);
    setIsPending(true);

    const telemetryAction = action === "hint" ? "hint" : action === "example" || action === "quiz_me" ? "deep-dive" : "explain";
    onMentorAction?.(telemetryAction, action);

    try {
      const response = await fetch(`/api/lessons/${lessonId}/mentor`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sceneTitle: activeSceneTitle,
          sceneRole: activeSceneRole,
          lessonTitle,
          conceptName,
          selectedEntity,
          visibleLogs,
          action,
          question: action === "freeform" ? userText : undefined,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        data?: { reply: string; mode: "model" | "simulated" };
        error?: { message?: string };
      };

      const data = body.data;
      if (!response.ok || !data) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: body.error?.message ?? "I could not respond at this time. Please try again.",
          },
        ]);
        onMentorReply?.(action, "fallback");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          mode: data.mode,
        },
      ]);
      onMentorReply?.(action, data.mode === "model" ? "success" : "fallback");
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error contacting mentor. Please verify your connection.",
        },
      ]);
      onMentorReply?.(action, "fallback");
    } finally {
      setIsPending(false);
      setInputValue("");
    }
  }

  function actionLabel(action: string): string {
    switch (action) {
      case "hint":
        return "Give me a hint";
      case "simplify":
        return "Explain more simply";
      case "explain_logs":
        return "Explain these logs";
      case "example":
        return "Show an example";
      case "quiz_me":
        return "Ask me a conceptual question";
      default:
        return "Explain this concept";
    }
  }

  return (
    <>
      {/* Floating Mentor Toggle Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label="Toggle AI Learning Mentor panel"
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all"
      >
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        ✨ AI Mentor {isOpen ? "✕" : ""}
      </button>

      {/* Slide-out Mentor Panel */}
      {isOpen ? (
        <aside
          role="complementary"
          aria-label="AI Learning Mentor chat"
          className="fixed bottom-16 right-3 sm:bottom-20 sm:right-5 z-40 flex h-[500px] max-h-[calc(100vh-5rem)] w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm flex-col rounded-2xl border border-border bg-card/95 p-3.5 sm:p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                ✦
              </span>
              <div>
                <h3 className="font-semibold text-foreground text-xs leading-none">
                  Contextual AI Mentor
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground truncate max-w-[200px]">
                  {activeSceneTitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground text-xs"
              aria-label="Close mentor panel"
            >
              ✕
            </button>
          </div>

          {/* Context Tag Banner */}
          {selectedEntity ? (
            <div className="my-2 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] text-foreground font-mono">
              <span className="text-muted-foreground">Inspecting: </span>
              {selectedEntity}
            </div>
          ) : null}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 text-xs">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-muted/70 text-foreground border border-border/50"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.mode ? (
                  <span className="mt-0.5 text-[9px] text-muted-foreground px-1">
                    {msg.mode === "simulated" ? "⚡ Deterministic mentor guidance" : "🤖 Model response"}
                  </span>
                ) : null}
              </div>
            ))}
            {isPending ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                <span>Mentor is reasoning…</span>
              </div>
            ) : null}
          </div>

          {/* Quick Action Chips */}
          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-2 pb-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => sendAction("hint")}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
            >
              💡 Give hint
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => sendAction("simplify")}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
            >
              🐣 Explain simply
            </button>
            {visibleLogs ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => sendAction("explain_logs")}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
              >
                🔍 Analyze logs
              </button>
            ) : null}
            <button
              type="button"
              disabled={isPending}
              onClick={() => sendAction("quiz_me")}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
            >
              🎯 Quiz me
            </button>
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputValue.trim() && !isPending) {
                sendAction("freeform", inputValue.trim());
              }
            }}
            className="flex items-center gap-1.5 pt-1.5"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about this scene…"
              disabled={isPending}
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
