"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Code2,
  Expand,
  ListFilter,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { ProblemDescription } from "./problem-description";
import { EditorPanel } from "./editor-panel";
import { ConsolePanel, type SubmitTestResult, type VisibleTestResult } from "./console-panel";
import { ProblemDrawer } from "./problem-drawer";
import type { PracticeQuestionDetail } from "@/lib/services/practice";

interface LeetCodeWorkspaceProps {
  question: PracticeQuestionDetail;
  onSelectQuestion: (questionId: string) => void;
  onBackToCatalog: () => void;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { success: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function getInitialLanguage(question: PracticeQuestionDetail): string {
  if (question.languages.includes("javascript")) return "javascript";
  return question.languages[0] ?? "javascript";
}

export function LeetCodeWorkspace({
  question,
  onSelectQuestion,
  onBackToCatalog,
}: LeetCodeWorkspaceProps) {
  const [language, setLanguage] = useState<string>(() => getInitialLanguage(question));
  const [code, setCode] = useState<string>(() => {
    const lang = getInitialLanguage(question);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`gurukul_code_${question.id}_${lang}`);
      if (saved) return saved;
    }
    return question.starterCode[lang] ?? "";
  });

  const [isProblemDrawerOpen, setIsProblemDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visibleResults, setVisibleResults] = useState<VisibleTestResult[] | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitTestResult | null>(null);
  const [activeAction, setActiveAction] = useState<"run" | "submit" | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const activeQuestionIdRef = useRef(question.id);

  // When question changes, re-sync language & code
  useEffect(() => {
    activeQuestionIdRef.current = question.id;
    const initialLang = getInitialLanguage(question);
    setLanguage(initialLang);

    const saved = localStorage.getItem(`gurukul_code_${question.id}_${initialLang}`);
    setCode(saved ?? question.starterCode[initialLang] ?? "");
    setSessionId(null);
    setVisibleResults(null);
    setSubmitResult(null);
    setError("");
  }, [question.id, question.starterCode]);

  // Persist code changes in localStorage
  function handleCodeChange(newCode: string) {
    setCode(newCode);
    try {
      localStorage.setItem(`gurukul_code_${question.id}_${language}`, newCode);
    } catch {
      // ignore storage quota errors
    }
  }

  function handleSelectLanguage(newLang: string) {
    setLanguage(newLang);
    const saved = localStorage.getItem(`gurukul_code_${question.id}_${newLang}`);
    const nextCode = saved ?? question.starterCode[newLang] ?? "";
    setCode(nextCode);
  }

  function handleResetStarter() {
    const starter = question.starterCode[language] ?? "";
    setCode(starter);
    try {
      localStorage.removeItem(`gurukul_code_${question.id}_${language}`);
    } catch {
      // ignore
    }
  }

  function handleRestoreCode(restoredCode: string, restoredLanguage: string) {
    if (question.languages.includes(restoredLanguage)) {
      setLanguage(restoredLanguage);
    }
    setCode(restoredCode);
  }

  // Session handling (strictly practice mode!)
  async function createPracticeSession(): Promise<string> {
    const result = await api<{ id: string; mode: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ questionId: question.id, mode: "practice" }),
    });
    setSessionId(result.id);
    return result.id;
  }

  async function handleRun() {
    setIsBusy(true);
    setActiveAction("run");
    setError("");
    setSubmitResult(null);
    setIsConsoleCollapsed(false);

    try {
      // Start fresh practice session or reuse
      const currentSessionId = sessionId ?? (await createPracticeSession());
      const result = await api<{ tests: VisibleTestResult[] }>(
        `/api/sessions/${currentSessionId}/run`,
        {
          method: "POST",
          body: JSON.stringify({ language, code }),
        },
      );
      setVisibleResults(result.tests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Run failed.");
    } finally {
      setIsBusy(false);
      setActiveAction(null);
    }
  }

  async function handleSubmit() {
    setIsBusy(true);
    setActiveAction("submit");
    setError("");
    setVisibleResults(null);
    setIsConsoleCollapsed(false);

    try {
      // Practice submit: always create a fresh session so repeated submits run freshly
      const newSessionId = await createPracticeSession();
      const result = await api<SubmitTestResult>(
        `/api/sessions/${newSessionId}/submit`,
        {
          method: "POST",
          body: JSON.stringify({ language, code }),
        },
      );
      setSubmitResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submit failed.");
    } finally {
      setIsBusy(false);
      setActiveAction(null);
    }
  }

  // Keyboard shortcut: Ctrl + Enter / Cmd + Enter to Run
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isBusy) void handleRun();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isBusy, language, code, sessionId]);

  // Sibling questions for prev / next
  const currentIndex = question.allChallenges.findIndex((c) => c.id === question.id);
  const prevChallenge = currentIndex > 0 ? question.allChallenges[currentIndex - 1] : null;
  const nextChallenge =
    currentIndex >= 0 && currentIndex < question.allChallenges.length - 1
      ? question.allChallenges[currentIndex + 1]
      : null;

  return (
    <div
      className={`flex flex-col bg-background text-foreground transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen p-3 bg-zinc-950 overflow-hidden"
          : "min-h-[calc(100vh-12rem)] space-y-3"
      }`}
    >
      {/* Top LeetCode Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-2.5 shadow-xs backdrop-blur-xs">
        {/* Left: Problem Selector & Steppers */}
        <div className="flex items-center gap-2">
          {/* Back to Catalog */}
          <button
            type="button"
            onClick={onBackToCatalog}
            className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">All Challenges</span>
          </button>

          {/* Problem List Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsProblemDrawerOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors"
          >
            <ListFilter className="size-3.5 text-primary" />
            <span>Problem List</span>
          </button>

          {/* Prev / Next buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!prevChallenge}
              onClick={() => prevChallenge && onSelectQuestion(prevChallenge.id)}
              title={prevChallenge ? `Previous: ${prevChallenge.title}` : "No previous problem"}
              className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              disabled={!nextChallenge}
              onClick={() => nextChallenge && onSelectQuestion(nextChallenge.id)}
              title={nextChallenge ? `Next: ${nextChallenge.title}` : "No next problem"}
              className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* Current Problem Title & Badge */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-border/60">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              #{question.number}
            </span>
            <span className="text-xs font-bold text-foreground truncate max-w-xs">
              {question.title}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                question.difficultyLabel === "Easy"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : question.difficultyLabel === "Medium"
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              {question.difficultyLabel}
            </span>
          </div>
        </div>

        {/* Right: Mode Badge & Fullscreen & OA link */}
        <div className="flex items-center gap-3">
          {/* Ungraded Practice Pill */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Practice Mode (Ungraded)</span>
          </div>

          {/* Fullscreen Zen Mode */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Editor"}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit Zen" : "Zen"}</span>
          </button>

          {/* Link to OA */}
          <Link
            href="/assessment"
            className="hidden lg:inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            <ShieldAlert className="size-3" />
            <span>OA Exam &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Main Split Layout: Left Problem Description & Right Editor/Console */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 ${isFullscreen ? "h-[calc(100vh-4.5rem)] overflow-hidden" : "min-h-[640px]"}`}>
        {/* Left Pane: Problem Description (5 cols) */}
        <div className="lg:col-span-5 h-full overflow-hidden">
          <ProblemDescription
            question={question}
            onRestoreCode={handleRestoreCode}
          />
        </div>

        {/* Right Pane: Code Editor + Console (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full gap-3 overflow-hidden">
          {/* Top: Editor Panel */}
          <div className="flex-1 min-h-[360px] overflow-hidden">
            <EditorPanel
              language={language}
              languages={question.languages}
              code={code}
              onChangeCode={handleCodeChange}
              onSelectLanguage={handleSelectLanguage}
              onResetStarter={handleResetStarter}
            />
          </div>

          {/* Bottom: Console Panel */}
          <div className="shrink-0">
            <ConsolePanel
              sampleTests={question.visibleTests}
              visibleResults={visibleResults}
              submitResult={submitResult}
              isBusy={isBusy}
              activeAction={activeAction}
              error={error}
              onRun={() => void handleRun()}
              onSubmit={() => void handleSubmit()}
              isCollapsed={isConsoleCollapsed}
              onToggleCollapse={() => setIsConsoleCollapsed(!isConsoleCollapsed)}
            />
          </div>
        </div>
      </div>

      {/* Quick Problem List Drawer */}
      <ProblemDrawer
        isOpen={isProblemDrawerOpen}
        onClose={() => setIsProblemDrawerOpen(false)}
        challenges={question.allChallenges}
        activeQuestionId={question.id}
        onSelectQuestion={onSelectQuestion}
        moduleName={question.moduleName}
      />
    </div>
  );
}
