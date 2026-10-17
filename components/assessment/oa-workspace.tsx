"use client";

/**
 * ============================================================================
 * ISOLATED ONLINE ASSESSMENT (OA) MODULE
 * ============================================================================
 * This module is completely isolated outside the Practice and Learn modules.
 * It provides the foundation for the serious, full-screen Online Assessment (OA)
 * environment with proctored telemetry, fullscreen enforcement, and test integrity.
 *
 * DO NOT MERGE OR COUPLE WITH PRACTICE OR LEARN MODULES.
 * ============================================================================
 */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import {
  AlertTriangle,
  CheckCircle2,
  Expand,
  FileCheck2,
  Lock,
  Maximize2,
  Minimize2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplainStep } from "@/components/practice/explain-step";
import { SessionRecorder } from "@/components/practice/recorder";
import { classifyModelChanges } from "@/lib/engine/editor-events";
import { openRecording } from "@/lib/engine/session-clock";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type PublicTest =
  | { id: string; visibility: "visible"; input: string; expectedOutput: string }
  | { id: string; visibility: "hidden" };

type Question = {
  id: string;
  statement: string;
  difficulty: number;
  languages: string[];
  starterCode: Record<string, string>;
  tests: PublicTest[];
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

type VisibleResult = {
  id: string;
  passed: boolean;
  outcome: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  message: string;
};

type SubmitResult = {
  passed: number;
  total: number;
  correct: boolean;
  attemptId: string | null;
  tests: { id: string; passed: boolean; category: string; message: string }[];
  mastery: { before: number; after: number }[];
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

function startingLanguage(question: Question | null) {
  if (question?.languages.includes("javascript")) return "javascript";
  return question?.languages[0] ?? "javascript";
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
  const [consentText, setConsentText] = useState(initialConsent);
  const [accepted, setAccepted] = useState(consentAccepted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [language, setLanguage] = useState(startingLanguage(initial.question));
  const [code, setCode] = useState(initial.question?.starterCode[startingLanguage(initial.question)] ?? "");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [visibleResults, setVisibleResults] = useState<VisibleResult[] | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  // Track Tab Visibility / Anti-cheat Telemetry
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setTabSwitches((count) => count + 1);
        recorder.current?.record("tab_hidden", { antiCheatNotice: "User navigated away from OA window" });
      } else {
        recorder.current?.record("tab_visible");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser permissions or user gesture constraints
    }
  };

  async function ensureSession() {
    const current = sessionRef.current;
    if (current && current.mode === "graded" && recorder.current) return current;
    if (starting.current) return starting.current;
    const pending = actuallyStart();
    starting.current = pending;
    try {
      return await pending;
    } finally {
      if (starting.current === pending) starting.current = null;
    }
  }

  async function actuallyStart(): Promise<SessionInfo> {
    const currentQuestion = questionRef.current;
    if (!currentQuestion) throw new Error("No assessment question available.");
    if (!acceptedRef.current) throw new Error("Accept proctoring consent before starting.");
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
    setConsentText(consent.consentText);
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

  async function run() {
    setBusy(true);
    setError("");
    try {
      const current = await ensureSession();
      recorder.current?.record("run", { language });
      const result = await api<{ tests: VisibleResult[] }>(`/api/sessions/${current.id}/run`, {
        method: "POST",
        body: JSON.stringify({ language, code }),
      });
      setVisibleResults(result.tests);
      recorder.current?.record("run_result", { outcomes: result.tests.map((test) => test.outcome) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const current = await ensureSession();
      recorder.current?.record("submit", { language });
      const result = await api<SubmitResult>(`/api/sessions/${current.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ language, code }),
      });
      setSubmitResult(result);
      recorder.current?.record("submit_result", {
        passed: result.passed,
        total: result.total,
        categories: result.tests.map((test) => test.category),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const question = next?.question ?? null;

  return (
    <div className="space-y-6">
      {/* Isolated Online Assessment Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-linear-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Online Assessment (OA) Environment
              </span>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-300 border border-amber-500/30">
                Isolated
              </span>
            </div>
            <h1 className="text-lg font-bold text-white">
              Official Coding Mastery Examination
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Fullscreen Mode Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void toggleFullscreen()}
            className="gap-2 border-zinc-700 bg-zinc-800/80 text-xs text-white hover:bg-zinc-700 hover:text-white"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="size-3.5" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                <span>Enter Fullscreen OA Mode</span>
              </>
            )}
          </Button>

          {/* Telemetry Status Indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
            <span className={`size-2 rounded-full ${session?.recording ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="font-mono text-[11px]">
              {session?.recording ? "Proctoring Active" : "Test Environment Ready"}
            </span>
          </div>
        </div>
      </div>

      {/* Fullscreen Advisory Banner if not in fullscreen */}
      {!isFullscreen ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <span>
              <strong>Fullscreen Recommendation:</strong> Standard Online Assessments require full-screen focus. Click &apos;Enter Fullscreen OA Mode&apos; for an uninterrupted testing session.
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void toggleFullscreen()}
            className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            Go Fullscreen
          </Button>
        </div>
      ) : null}

      {/* Tab Switch Warning if any detected */}
      {tabSwitches > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs text-destructive font-medium">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Integrity Alert: {tabSwitches} window or tab defocus event(s) logged to the audit replay queue.
          </span>
        </div>
      ) : null}

      {/* Proctoring Consent Agreement */}
      {!accepted ? (
        <section className="rounded-xl border border-border/80 bg-card p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Lock className="size-4 text-primary" />
            <span>Online Assessment Proctoring & Telemetry Consent</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {consentText}
          </p>
          <Button size="sm" onClick={() => void accept()} className="text-xs mt-2">
            I agree, begin my Online Assessment
          </Button>
        </section>
      ) : null}

      {/* Question & Code Challenge Runner */}
      {question ? (
        <section className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-mono font-semibold text-foreground">
                Difficulty {question.difficulty}
              </span>
              <h2 className="text-base font-semibold text-foreground">
                Assessment Coding Challenge
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Language:</span>
              <select
                id="oa-language"
                className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setCode(question.starterCode[e.target.value] ?? "");
                }}
              >
                {question.languages.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {question.statement}
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {question.tests
                .filter((test) => test.visibility === "visible")
                .map((test) =>
                  test.visibility === "visible" ? (
                    <li key={test.id} className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">Sample Test:</span>
                      <span>in</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground border border-border/60">
                        {test.input.trim() || "(empty)"}
                      </code>
                      <span>&rarr; expected</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground border border-border/60">
                        {test.expectedOutput.trim()}
                      </code>
                    </li>
                  ) : null,
                )}
              <li className="text-[11px] text-muted-foreground italic">
                {question.tests.filter((test) => test.visibility === "hidden").length} hidden tests execute securely in sandbox evaluation.
              </li>
            </ul>
          </div>

          {/* Monaco Editor Container */}
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 font-mono text-[11px] text-zinc-400">
              <span>solution.{language === "cpp" ? "cpp" : language === "javascript" ? "js" : language}</span>
              <span className="text-[10px] text-zinc-400">Secure Sandboxed Editor</span>
            </div>
            <Editor
              height="380px"
              language={language === "cpp" ? "cpp" : language}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? "")}
              onMount={onMount}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={() => void run()} disabled={busy || !accepted} className="text-xs">
              Run Sample Tests
            </Button>
            <Button
              variant="default"
              onClick={() => void submit()}
              disabled={busy || !accepted}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Submit Official Assessment
            </Button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No published question is scheduled for this assessment concept.
        </p>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Visible Run Output */}
      {visibleResults ? (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Sample Test Results</h3>
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {visibleResults.filter((t) => t.passed).length} of {visibleResults.length} passed
            </span>
          </div>
          <div className="space-y-2.5">
            {visibleResults.map((test) => (
              <article key={test.id} className="rounded-lg border border-border/70 bg-background/50 p-3.5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                      test.passed
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border border-destructive/20 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {test.passed ? "Passed" : test.message}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{test.durationMs} ms</span>
                </div>
                {test.stdout ? (
                  <pre className="overflow-auto rounded-md bg-zinc-950 p-2.5 font-mono text-xs text-zinc-200 border border-border/60">{test.stdout}</pre>
                ) : null}
                {test.stderr ? (
                  <pre className="overflow-auto rounded-md bg-destructive/10 p-2.5 font-mono text-xs text-destructive border border-destructive/20">{test.stderr}</pre>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Submit Evaluation Output */}
      {submitResult ? (
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Official Evaluation · {submitResult.passed}/{submitResult.total} Hidden Tests Passed
            </h3>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                submitResult.correct
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {submitResult.correct ? "All Passed" : "Partial Pass"}
            </span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {submitResult.tests.map((test, index) => (
              <li key={test.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-1.5">
                <span className="font-medium text-foreground">Hidden Test {index + 1}</span>
                <span
                  className={`font-semibold text-[11px] ${
                    test.passed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {test.passed ? "Passed" : `${test.category}. ${test.message}`}
                </span>
              </li>
            ))}
          </ul>
          {submitResult.mastery.map((update, index) => (
            <p key={index} className="pt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Bayesian Knowledge Tracing (BKT) Mastery updated from {update.before.toFixed(2)} to {update.after.toFixed(2)}.
            </p>
          ))}
        </section>
      ) : null}

      {submitResult?.attemptId ? <ExplainStep attemptId={submitResult.attemptId} /> : null}
    </div>
  );
}
