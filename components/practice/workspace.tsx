"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
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

type Alternative = { conceptId: string; name: string; mastery: number; note: string };

type NextPayload = {
  moduleName: string;
  decision: {
    conceptId: string;
    reason: string;
    alternatives: Alternative[];
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

export function PracticeWorkspace({
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
  const [mode, setMode] = useState<"practice" | "graded">("practice");
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
  const modeRef = useRef(mode);
  const acceptedRef = useRef(accepted);
  const questionRef = useRef(initial.question);

  useEffect(() => {
    modeRef.current = mode;
    acceptedRef.current = accepted;
    questionRef.current = next.question ?? null;
    if (session) sessionRef.current = session;
    else if (!recorder.current) sessionRef.current = null;
  }, [mode, accepted, next.question, session]);

  function resetCapture(nextText: string) {
    pendingEdits.current = [];
    pendingBaseline.current = null;
    documentText.current = nextText;
  }

  async function load() {
    const learning = await api<NextPayload>("/api/learning");
    const nextLanguage = startingLanguage(learning.question);
    const nextText = learning.question?.starterCode[nextLanguage] ?? "";
    questionRef.current = learning.question;
    suppressCapture.current = documentText.current !== nextText;
    recorder.current?.record("session_end");
    recorder.current?.dispose();
    recorder.current = null;
    sessionRef.current = null;
    resetCapture(nextText);
    setNext(learning);
    setLanguage(nextLanguage);
    setCode(nextText);
    setSession(null);
    setVisibleResults(null);
    setSubmitResult(null);
    setError("");
  }

  useEffect(() => {
    const onVisibility = () => {
      recorder.current?.record(document.hidden ? "tab_hidden" : "tab_visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const question = next?.question ?? null;

  async function ensureSession() {
    const current = sessionRef.current;
    const currentMode = modeRef.current;
    if (current && current.mode === currentMode && recorder.current) return current;
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
    const currentMode = modeRef.current;
    if (!currentQuestion) throw new Error("No question is available");
    if (currentMode === "graded" && !acceptedRef.current) throw new Error("Record consent before a graded session.");
    const created = await api<SessionInfo>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ questionId: currentQuestion.id, mode: currentMode }),
    });
    if (modeRef.current !== currentMode || questionRef.current?.id !== currentQuestion.id) {
      throw new Error("Session start was interrupted.");
    }
    const buffered = pendingEdits.current.splice(0);
    const baseline = pendingBaseline.current ?? documentText.current;
    pendingBaseline.current = null;
    const now = Date.now();
    const opened = openRecording({ buffered, now, mode: created.mode, baseline });
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
    if (modeRef.current === "graded" && !acceptedRef.current) return;
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
      if (modeRef.current === "graded" && !acceptedRef.current) {
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

  function chooseLanguage(nextLanguage: string) {
    setLanguage(nextLanguage);
    setCode(question?.starterCode[nextLanguage] ?? "");
  }

  return (
    <div className="space-y-6">
      {session?.recording ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300 font-medium">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Active assessment session: Keystroke timeline and run signals are recorded for integrity review.</span>
        </div>
      ) : null}

      <section className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
            Target Module
          </span>
          <p className="text-xs font-mono text-muted-foreground">{next.moduleName}</p>
        </div>
        <p className="mt-2 text-base font-semibold text-foreground leading-snug">{next.decision.reason}</p>
        {next.decision.alternatives.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Alternative concepts evaluated
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {next.decision.alternatives.map((item) => (
                <li key={item.conceptId} className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span>·</span>
                  <span className="font-mono">{item.mastery.toFixed(2)}</span>
                  <span>·</span>
                  <span>{item.note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {mode === "graded" && !accepted ? (
        <section className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs">
          <h2 className="font-semibold text-foreground text-sm">Graded Assessment Consent</h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{consentText}</p>
          <Button className="mt-3 text-xs" onClick={() => void accept()}>
            I agree, record this graded session
          </Button>
        </section>
      ) : null}

      {question ? (
        <section className="space-y-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-foreground">
                Difficulty {question.difficulty}
              </span>
              <h2 className="text-base font-semibold text-foreground">Coding Challenge</h2>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5" htmlFor="mode">
                Mode:
                <select
                  id="mode"
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  value={mode}
                  onChange={(event) => {
                    const nextMode = event.target.value === "graded" ? "graded" : "practice";
                    recorder.current?.record("session_end");
                    recorder.current?.dispose();
                    recorder.current = null;
                    sessionRef.current = null;
                    modeRef.current = nextMode;
                    resetCapture(documentText.current);
                    setMode(nextMode);
                    setSession(null);
                    setSubmitResult(null);
                  }}
                >
                  <option value="practice">Practice (Ungraded)</option>
                  <option value="graded">Graded Assessment</option>
                </select>
              </label>

              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5" htmlFor="language">
                Language:
                <select
                  id="language"
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  value={language}
                  onChange={(event) => chooseLanguage(event.target.value)}
                >
                  {question.languages.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground leading-relaxed">{question.statement}</p>
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
                {question.tests.filter((test) => test.visibility === "hidden").length} hidden tests stay on the server.
              </li>
            </ul>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 font-mono text-[11px] text-zinc-400">
              <span>solution.{language === "cpp" ? "cpp" : language === "javascript" ? "js" : language}</span>
              <span className="text-[10px] text-zinc-400">Monaco Sandbox Editor</span>
            </div>
            <Editor
              height="360px"
              language={language === "cpp" ? "cpp" : language}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? "")}
              onMount={onMount}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={() => void run()} disabled={busy || (mode === "graded" && !accepted)}>
              Run Samples
            </Button>
            <Button variant="secondary" onClick={() => void submit()} disabled={busy || (mode === "graded" && !accepted)}>
              Submit Assessment
            </Button>
            <Button variant="outline" onClick={() => void load()}>
              Next question
            </Button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No published question is available for this concept.</p>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

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

      {submitResult ? (
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Assessment Submission · {submitResult.passed}/{submitResult.total} Hidden Tests Passed
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
              BKT Mastery updated from {update.before.toFixed(2)} to {update.after.toFixed(2)}.
            </p>
          ))}
        </section>
      ) : null}

      {mode === "graded" && submitResult?.attemptId ? <ExplainStep attemptId={submitResult.attemptId} /> : null}
    </div>
  );
}
