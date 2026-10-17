"use client";

/**
 * ============================================================================
 * ONLINE ASSESSMENT (OA) WORKSPACE - LEETCODE IDENTICAL UI
 * ============================================================================
 * Provides an identical split-pane LeetCode layout to Practice Lab:
 * - Left Pane: Problem Description (Statement, Examples, Constraints, Submissions)
 * - Right Pane: Monaco Editor Panel + Console Panel (Testcase, Test Results)
 * - Pre-Flight Check: Mid-screen verification ("yes" confirmation) before start
 * - Automatic Fullscreen on confirmation
 * - Silent Background Telemetry (integrity recorded for trainer review,
 *   never shown as an alert/warning to the participant)
 * ============================================================================
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { OnMount } from "@monaco-editor/react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code2,
  Expand,
  FileCheck2,
  HelpCircle,
  Lock,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
} from "lucide-react";

import { ProblemDescription } from "@/components/practice/problem-description";
import { EditorPanel } from "@/components/practice/editor-panel";
import {
  ConsolePanel,
  type SubmitTestResult,
  type VisibleTestResult,
} from "@/components/practice/console-panel";
import { SessionRecorder } from "@/components/practice/recorder";
import { classifyModelChanges } from "@/lib/engine/editor-events";
import { openRecording } from "@/lib/engine/session-clock";
import type { PracticeQuestionDetail } from "@/lib/services/practice";

type PublicTest =
  | { id: string; visibility: "visible"; input: string; expectedOutput: string }
  | { id: string; visibility: "hidden" };

type Question = {
  id: string;
  statement: string;
  difficulty: number;
  languages: string[];
  starterCode: Record<string, string>;
  status: string;
  conceptIds: string[];
  tests: PublicTest[];
  visibleTestCount: number;
  hiddenTestCount: number;
};

type NextPayload = {
  moduleId: string;
  moduleName: string;
  decision: {
    conceptId: string;
    reason: string;
    alternatives: { conceptId: string; name: string; mastery: number; note: string }[];
    predictedSuccess: number | null;
  };
  question: Question | null;
};

type SessionInfo = { id: string; mode: "practice" | "graded"; recording: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { success: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function startingLanguage(question: Question | null): string {
  if (!question) return "javascript";
  if (question.languages.includes("javascript")) return "javascript";
  return question.languages[0] ?? "javascript";
}

function difficultyLabel(difficulty: number): "Easy" | "Medium" | "Hard" {
  if (difficulty <= 2) return "Easy";
  if (difficulty === 3) return "Medium";
  return "Hard";
}

export function OAWorkspace({
  initial,
  consentText: initialConsent,
  consentAccepted,
}: {
  initial: NextPayload;
  consentText: string;
  consentAccepted: boolean;
}) {
  const [next, setNext] = useState<NextPayload>(initial);
  const [accepted, setAccepted] = useState(consentAccepted);
  const [isStarted, setIsStarted] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);

  const [language, setLanguage] = useState(startingLanguage(initial.question));
  const [code, setCode] = useState(initial.question?.starterCode[startingLanguage(initial.question)] ?? "");
  const [session, setSession] = useState<SessionInfo | null>(null);

  const [visibleResults, setVisibleResults] = useState<VisibleTestResult[] | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitTestResult | null>(null);
  const [activeAction, setActiveAction] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Timer: Elapsed seconds in examination
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Local submission history for the Submissions tab
  const [pastSubmissions, setPastSubmissions] = useState<PracticeQuestionDetail["pastSubmissions"]>([]);

  // Telemetry Recorder refs (Silent, non-intrusive for student, stored for trainer review)
  const recorder = useRef<SessionRecorder | null>(null);
  const pasted = useRef(false);
  const acceptedSuggestion = useRef(false);
  const documentText = useRef(initial.question?.starterCode[startingLanguage(initial.question)] ?? "");
  const pendingBaseline = useRef<string | null>(null);
  const pendingEdits = useRef<{ type: string; payload: Record<string, unknown>; at: number }[]>([]);
  const suppressCapture = useRef(false);
  const starting = useRef<Promise<SessionInfo> | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const acceptedRef = useRef(accepted);
  const questionRef = useRef(initial.question);

  useEffect(() => {
    acceptedRef.current = accepted;
    questionRef.current = next.question ?? null;
    if (session) sessionRef.current = session;
    else if (!recorder.current) sessionRef.current = null;
  }, [accepted, next.question, session]);

  // Track Fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Timer counter when examination has started
  useEffect(() => {
    if (!isStarted) return;
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isStarted]);

  // Silent Background Telemetry: Track Tab Visibility for Trainer Review (NO student-facing alerts)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        // Record silently in background telemetry for trainer's review
        recorder.current?.record("tab_hidden", { timestamp: Date.now() });
      } else {
        recorder.current?.record("tab_visible", { timestamp: Date.now() });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  async function ensureSession(): Promise<SessionInfo> {
    if (sessionRef.current) return sessionRef.current;
    if (starting.current) return starting.current;
    starting.current = createSession();
    try {
      return await starting.current;
    } finally {
      starting.current = null;
    }
  }

  async function createSession(): Promise<SessionInfo> {
    const currentQuestion = questionRef.current;
    if (!currentQuestion) throw new Error("No active assessment question available.");
    const created = await api<SessionInfo>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ questionId: currentQuestion.id, mode: "graded" }),
    });
    if (questionRef.current?.id !== currentQuestion.id) {
      throw new Error("Assessment session was interrupted.");
    }
    const buffered = pendingEdits.current.splice(0);
    const baseline = pendingBaseline.current ?? documentText.current;
    pendingBaseline.current = null;
    const now = Date.now();
    const opened = openRecording({ buffered, now, mode: "graded", baseline });
    recorder.current?.record("session_end");
    recorder.current?.dispose();
    const nextRecorder = new SessionRecorder(created.id, { originMs: opened.originMs });
    recorder.current = nextRecorder;
    let batch: { type: string; payload: Record<string, unknown>; at: number }[] = opened.entries;
    while (batch.length > 0) {
      for (const entry of batch) nextRecorder.recordAt(entry.type, entry.payload, entry.at);
      batch = pendingEdits.current.splice(0);
    }
    sessionRef.current = created;
    setSession(created);
    return created;
  }

  async function accept() {
    const consent = await api<{ accepted: boolean; consentText: string }>("/api/consent", { method: "POST" });
    acceptedRef.current = consent.accepted;
    setAccepted(consent.accepted);
  }

  function capture(type: string, payload: Record<string, unknown> = {}) {
    if (!acceptedRef.current) return;
    if (recorder.current && !starting.current) {
      recorder.current.record(type, payload);
      return;
    }
    pendingEdits.current.push({ type, payload, at: Date.now() });
  }

  const onMount: OnMount = (editor) => {
    documentText.current = editor.getModel()?.getValue() ?? documentText.current;
    const dom = editor.getContainerDomNode();
    dom.addEventListener(
      "paste",
      () => {
        pasted.current = true;
        window.setTimeout(() => {
          pasted.current = false;
        }, 0);
      },
      true,
    );
    const suggest = editor.getContribution("editor.contrib.suggestController") as {
      model?: { accept?: (item: unknown) => unknown };
    } | null;
    const suggestModel = suggest?.model;
    if (suggestModel?.accept) {
      const acceptSuggestion = suggestModel.accept.bind(suggestModel);
      suggestModel.accept = (item: unknown) => {
        acceptedSuggestion.current = true;
        try {
          return acceptSuggestion(item);
        } finally {
          window.setTimeout(() => {
            acceptedSuggestion.current = false;
          }, 0);
        }
      };
    }
    editor.onDidChangeModelContent((event) => {
      const previous = documentText.current;
      const nextText = editor.getModel()?.getValue() ?? previous;
      if (suppressCapture.current) {
        documentText.current = nextText;
        suppressCapture.current = false;
        pasted.current = false;
        acceptedSuggestion.current = false;
        return;
      }
      if (!acceptedRef.current) {
        documentText.current = nextText;
        pasted.current = false;
        acceptedSuggestion.current = false;
        return;
      }
      const edits = classifyModelChanges({
        previousText: previous,
        changes: event.changes.map((change) => ({
          rangeOffset: change.rangeOffset,
          rangeLength: change.rangeLength,
          text: change.text,
        })),
        isUndoing: event.isUndoing,
        isRedoing: event.isRedoing,
        pasted: pasted.current,
        autocomplete: acceptedSuggestion.current,
      });
      if (edits.length > 0 && !recorder.current && pendingBaseline.current === null) {
        pendingBaseline.current = previous;
      }
      for (const edit of edits) {
        capture(edit.type, { ...edit.payload, range: { ...edit.payload.range } });
      }
      documentText.current = nextText;
      pasted.current = false;
      acceptedSuggestion.current = false;
      if (edits.length > 0 && !recorder.current) void ensureSession().catch(() => undefined);
    });
    editor.onDidFocusEditorText(() => capture("focus"));
    editor.onDidBlurEditorText(() => capture("blur"));
    const node = editor.getContainerDomNode();
    node.addEventListener("copy", () => capture("copy"));
    node.addEventListener("cut", () => capture("cut"));
  };

  async function handleStartVerification() {
    try {
      await accept();
      // Auto-enter fullscreen mode
      if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // ignore fullscreen refusal
        }
      }
      setIsStarted(true);
      void ensureSession().catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify examination check-in.");
    }
  }

  async function run() {
    setBusy(true);
    setActiveAction("run");
    setError("");
    setSubmitResult(null);
    setIsConsoleCollapsed(false);

    try {
      const current = await ensureSession();
      recorder.current?.record("run", { language });
      const result = await api<{
        tests: VisibleTestResult[];
        compilationError?: string;
        runtimeError?: string;
      }>(`/api/sessions/${current.id}/run`, {
        method: "POST",
        body: JSON.stringify({ language, code }),
      });
      setVisibleResults(result.tests);
      recorder.current?.record("run_result", { outcomes: result.tests.map((test) => test.outcome) });

      // Append to submissions history
      const allPassed = result.tests.every((t) => t.passed);
      setPastSubmissions((prev) => [
        {
          id: `run-${Date.now()}`,
          kind: "run",
          passed: allPassed,
          passRate: result.tests.filter((t) => t.passed).length / result.tests.length,
          language,
          code,
          createdAt: new Date().toISOString(),
          durationMs: Math.max(...result.tests.map((t) => t.durationMs), 0),
        },
        ...prev,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Run failed");
    } finally {
      setBusy(false);
      setActiveAction(null);
    }
  }

  async function submit() {
    setBusy(true);
    setActiveAction("submit");
    setError("");
    setVisibleResults(null);
    setIsConsoleCollapsed(false);

    try {
      const current = await ensureSession();
      recorder.current?.record("submit", { language });
      const result = await api<SubmitTestResult & { mastery?: { before: number; after: number }[] }>(
        `/api/sessions/${current.id}/submit`,
        {
          method: "POST",
          body: JSON.stringify({ language, code }),
        },
      );
      setSubmitResult(result);
      recorder.current?.record("submit_result", {
        passed: result.passed,
        total: result.total,
        categories: result.tests.map((test) => test.category),
      });

      // Append to submissions history
      setPastSubmissions((prev) => [
        {
          id: result.attemptId ?? `submit-${Date.now()}`,
          kind: "submit",
          passed: result.correct,
          passRate: result.passed / result.total,
          language,
          code,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submit failed");
    } finally {
      setBusy(false);
      setActiveAction(null);
    }
  }

  // Keyboard shortcut: Ctrl + Enter / Cmd + Enter to Run
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!busy && isStarted) void run();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, isStarted, language, code]);

  const question = next?.question ?? null;

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-border/80 bg-card space-y-4 shadow-sm">
        <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
          <Sparkles className="size-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Assessment Complete</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          There are no scheduled questions pending for this concept. All syllabus concepts are mastered!
        </p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Return to Student Dashboard
        </Link>
      </div>
    );
  }

  // Extract visible tests for sample testing
  const visibleTests = question.tests
    .filter((t): t is { id: string; visibility: "visible"; input: string; expectedOutput: string } => t.visibility === "visible")
    .map((t) => ({ id: t.id, input: t.input, expectedOutput: t.expectedOutput }));

  // Map to PracticeQuestionDetail shape so ProblemDescription renders identically to Practice Lab
  const mappedQuestion: PracticeQuestionDetail = {
    id: question.id,
    number: 1,
    title: question.statement.split(".")[0]?.trim() || "Online Assessment Problem",
    statement: question.statement,
    difficulty: question.difficulty,
    difficultyLabel: difficultyLabel(question.difficulty),
    conceptId: next.decision.conceptId,
    conceptName: next.moduleName || "Examination Target",
    moduleId: next.moduleId,
    moduleName: next.moduleName,
    languages: question.languages,
    starterCode: question.starterCode,
    status: submitResult?.correct ? "solved" : pastSubmissions.length > 0 ? "attempted" : "todo",
    examples: visibleTests.map((t, idx) => ({
      id: `ex-${idx + 1}`,
      input: t.input.trim(),
      output: t.expectedOutput.trim(),
      explanation: `Expected return value corresponding to sample input ${idx + 1}.`,
    })),
    constraints: [
      "Standard input/output parameters via function signature",
      "Time Limit: 2000 ms per test case",
      "Memory Limit: 256 MB in isolated container sandbox",
    ],
    hints: [
      "Write your main solution logic inside the provided function block.",
      "Arguments are passed directly as function parameters — return the result directly.",
    ],
    editorial: {
      intuition: "In official assessment mode, implementation logic should be written within the function block.",
      approach: "1. Process function arguments.\n2. Return computed answer directly from function.",
      keyConcepts: [next.moduleName, "Algorithm Efficiency", "Process Integrity"],
      complexity: { time: "O(1) to O(n)", space: "O(1)" },
    },
    visibleTests,
    hiddenTestCount: question.hiddenTestCount,
    pastSubmissions,
    allChallenges: [
      {
        id: question.id,
        number: 1,
        title: question.statement.split(".")[0]?.trim() || "Official Assessment",
        difficultyLabel: difficultyLabel(question.difficulty),
        status: submitResult?.correct ? "solved" : pastSubmissions.length > 0 ? "attempted" : "todo",
      },
    ],
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isConfirmedYes = verifyInput.trim().toLowerCase() === "yes";

  return (
    <div
      className={`flex flex-col bg-background text-foreground transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen p-3 bg-zinc-950 overflow-hidden"
          : "min-h-[calc(100vh-12rem)] space-y-3"
      }`}
    >
      {/* =========================================================================
          MID-SCREEN VERIFICATION MODAL (Pre-flight check before examination starts)
          ========================================================================= */}
      {!isStarted ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-zinc-100 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FileCheck2 className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Official Coding Assessment
                  </span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    Proctored
                  </span>
                </div>
                <h2 className="text-base font-bold text-white">
                  Examination Pre-Flight Verification
                </h2>
              </div>
            </div>

            {/* Assessment Specs */}
            <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Module:</span>
                <span className="font-semibold text-zinc-200">{next.moduleName}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Problem Difficulty:</span>
                <span
                  className={`font-semibold ${
                    mappedQuestion.difficultyLabel === "Easy"
                      ? "text-emerald-400"
                      : mappedQuestion.difficultyLabel === "Medium"
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {mappedQuestion.difficultyLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Evaluation Suite:</span>
                <span className="font-mono text-zinc-300">
                  {visibleTests.length} Sample + {question.hiddenTestCount} Hidden Tests
                </span>
              </div>
            </div>

            {/* Guidelines */}
            <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  The workspace is formatted in the LeetCode split-view structure with pure function blocks.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Upon confirmation, your browser will automatically transition into full-screen examination mode.
                </span>
              </p>
            </div>

            {/* Verification Prompt (Must say/type "yes") */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <label className="block text-xs font-medium text-zinc-300">
                Are you ready to begin the test? Please type <strong className="text-emerald-400 font-mono">yes</strong> to confirm:
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isConfirmedYes) void handleStartVerification();
                  }}
                  placeholder='Type "yes" here...'
                  autoFocus
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-hidden"
                />

                <button
                  type="button"
                  onClick={() => setVerifyInput("yes")}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                >
                  Auto &quot;yes&quot;
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/dashboard"
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel &amp; Return to Dashboard
                </Link>

                <button
                  type="button"
                  disabled={!isConfirmedYes}
                  onClick={() => void handleStartVerification()}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  <ShieldCheck className="size-4" />
                  <span>Yes, Begin Test</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          TOP LEETCODE NAVIGATION BAR (Identical to Practice Lab)
          ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-2.5 shadow-xs backdrop-blur-xs">
        {/* Left: Problem Details & Title */}
        <div className="flex items-center gap-2">
          {/* Back to Dashboard */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Exit Exam</span>
          </Link>

          {/* Current Problem Title & Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-border/60">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              #1
            </span>
            <span className="text-xs font-bold text-foreground truncate max-w-xs sm:max-w-md">
              {mappedQuestion.title}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                mappedQuestion.difficultyLabel === "Easy"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : mappedQuestion.difficultyLabel === "Medium"
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              {mappedQuestion.difficultyLabel}
            </span>
          </div>
        </div>

        {/* Right: Live Timer, Official Badge & Zen Mode */}
        <div className="flex items-center gap-3">
          {/* Live Exam Elapsed Timer */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-mono font-medium text-foreground">
            <Clock className="size-3.5 text-zinc-400" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          {/* Official Graded Badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Official Assessment (Graded)</span>
          </div>

          {/* Fullscreen Zen Mode Toggle */}
          <button
            type="button"
            onClick={async () => {
              if (!isFullscreen && document.documentElement.requestFullscreen) {
                try {
                  await document.documentElement.requestFullscreen();
                } catch {
                  // ignore
                }
              } else if (isFullscreen && document.exitFullscreen) {
                try {
                  await document.exitFullscreen();
                } catch {
                  // ignore
                }
              }
              setIsFullscreen(!isFullscreen);
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit Zen" : "Zen"}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN SPLIT LAYOUT (Identical to Practice Lab)
          Left Pane: Problem Description (5 cols)
          Right Pane: Code Editor + Console Panel (7 cols)
          ========================================================================= */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 ${
          isFullscreen ? "h-[calc(100vh-4.5rem)] overflow-hidden" : "min-h-[640px]"
        }`}
      >
        {/* Left Pane: Problem Description */}
        <div className="lg:col-span-5 h-full overflow-hidden">
          <ProblemDescription
            question={mappedQuestion}
            onRestoreCode={(restoredCode, restoredLanguage) => {
              if (question.languages.includes(restoredLanguage)) setLanguage(restoredLanguage);
              setCode(restoredCode);
            }}
          />
        </div>

        {/* Right Pane: Code Editor + Console */}
        <div className="lg:col-span-7 flex flex-col h-full gap-3 overflow-hidden">
          {/* Top: Editor Panel */}
          <div className="flex-1 min-h-[360px] overflow-hidden">
            <EditorPanel
              language={language}
              languages={question.languages}
              code={code}
              onChangeCode={(newCode) => {
                setCode(newCode);
                documentText.current = newCode;
              }}
              onSelectLanguage={(newLang) => {
                setLanguage(newLang);
                setCode(question.starterCode[newLang] ?? "");
              }}
              onResetStarter={() => {
                setCode(question.starterCode[language] ?? "");
              }}
              onMountEditor={onMount}
            />
          </div>

          {/* Bottom: Console Panel */}
          <div className="shrink-0">
            <ConsolePanel
              sampleTests={visibleTests}
              visibleResults={visibleResults}
              submitResult={submitResult}
              isBusy={busy}
              activeAction={activeAction}
              error={error}
              onRun={() => void run()}
              onSubmit={() => void submit()}
              isCollapsed={isConsoleCollapsed}
              onToggleCollapse={() => setIsConsoleCollapsed(!isConsoleCollapsed)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
