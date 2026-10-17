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
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-all"
      >
        <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>AI Mentor</span>
        {isOpen ? <span className="ml-0.5 font-mono text-xs">✕</span> : null}
      </button>

      {/* Slide-out Mentor Panel */}
      {isOpen ? (
        <aside
          role="complementary"
          aria-label="AI Learning Mentor chat"
          className="fixed bottom-16 right-3 sm:bottom-20 sm:right-5 z-40 flex h-[520px] max-h-[calc(100vh-5rem)] w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm flex-col rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
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
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground text-xs transition-colors"
              aria-label="Close mentor panel"
            >
              ✕
            </button>
          </div>

          {/* Context Tag Banner */}
          {selectedEntity ? (
            <div className="my-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] text-foreground font-mono">
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
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap shadow-2xs ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-muted/70 text-foreground border border-border/60"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.mode ? (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                    {msg.mode === "simulated" ? "Deterministic mentor guidance" : "Generative mentor response"}
                  </span>
                ) : null}
              </div>
            ))}
            {isPending ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
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
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              <svg className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Give hint
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => sendAction("simplify")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              <svg className="h-3 w-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Explain simply
            </button>
            {visibleLogs ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => sendAction("explain_logs")}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Analyze logs
              </button>
            ) : null}
            <button
              type="button"
              disabled={isPending}
              onClick={() => sendAction("quiz_me")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Quiz me
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
            className="flex items-center gap-2 pt-1.5"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about this scene…"
              disabled={isPending}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
