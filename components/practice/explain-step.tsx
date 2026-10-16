"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

type ExplainQuestion = {
  id: string;
  type: string;
  prompt: string;
  startLine: number;
  endLine: number;
  quote: string;
  answer: string | null;
  verdict: "yes" | "partial" | "no" | null;
  verdictLabel: string | null;
  evidence: string[];
  missed: string[];
  reviewStatus: "none" | "needs_review" | null;
};

type ExplainSet = {
  id: string;
  status: "open" | "answered" | "unavailable";
  note: string | null;
  questions: ExplainQuestion[];
};

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as { success: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Request failed");
  return payload.data as T;
}

export function ExplainStep({ attemptId }: { attemptId: string }) {
  const [set, setSet] = useState<ExplainSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "saving">("loading");

  async function load() {
    setPhase("loading");
    setError("");
    try {
      const next = await postJson<ExplainSet>(`/api/attempts/${attemptId}/explain`);
      setSet(next);
      setAnswers(Object.fromEntries(next.questions.map((question) => [question.id, ""])));
      setPhase("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The questions could not be prepared");
      setPhase("ready");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await postJson<ExplainSet>(`/api/attempts/${attemptId}/explain`);
        if (cancelled) return;
        setSet(next);
        setAnswers(Object.fromEntries(next.questions.map((question) => [question.id, ""])));
        setPhase("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "The questions could not be prepared");
        setPhase("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!set) return;
    setPhase("saving");
    setError("");
    try {
      const next = await postJson<ExplainSet>(`/api/attempts/${attemptId}/explain/answers`, {
        answers: set.questions.map((question) => ({ id: question.id, text: answers[question.id] ?? "" })),
      });
      setSet(next);
      setPhase("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The answers could not be saved");
      setPhase("ready");
    }
  }

  return (
    <section className="rounded-lg border border-border p-4 text-sm" aria-labelledby="explain-heading">
      <h3 id="explain-heading" className="font-medium">
        Explain your code
      </h3>
      <p className="mt-1 text-muted-foreground">
        These questions are about the solution you just submitted. A short, specific answer is enough. This step does
        not change the hidden-test score or mastery.
      </p>
      <p className="mt-2" role="status">
        {phase === "loading" ? "Preparing questions…" : null}
        {phase === "saving" ? "Saving your answers…" : null}
        {set?.status === "answered" ? "Your answers are recorded." : null}
      </p>
      {error ? (
        <p className="mt-2 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {error && !set ? (
        <Button className="mt-3" type="button" variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      ) : null}
      {set?.status === "unavailable" ? (
        <div className="mt-3 space-y-3">
          <p>{set.note}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}
      {set && set.status === "open" ? (
        <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
          {set.questions.map((question, index) => {
            const fieldId = `explain-${question.id}`;
            const line =
              question.startLine === question.endLine
                ? `Line ${question.startLine}`
                : `Lines ${question.startLine}–${question.endLine}`;
            return (
              <div key={question.id}>
                <label className="font-medium" htmlFor={fieldId}>
                  {index + 1}. {question.prompt}
                </label>
                <p id={`${fieldId}-source`} className="mt-1 text-muted-foreground">
                  {line}: <code>{question.quote}</code>
                </p>
                <textarea
                  id={fieldId}
                  className="mt-2 min-h-20 w-full rounded-md border border-border bg-background p-2"
                  aria-describedby={`${fieldId}-source`}
                  value={answers[question.id] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                />
              </div>
            );
          })}
          <Button type="submit" disabled={phase === "saving"}>
            Submit answers
          </Button>
        </form>
      ) : null}
      {set?.status === "answered" ? (
        <ol className="mt-4 space-y-3">
          {set.questions.map((question) => (
            <li key={question.id}>
              <p className="font-medium">{question.prompt}</p>
              <p className="mt-1">Your answer: {question.answer || "No answer"}</p>
              <p className="mt-1">
                {question.verdictLabel ?? "Not enough evidence"}
                {question.reviewStatus === "needs_review" ? " · Needs review" : ""}
              </p>
              {question.evidence.map((item) => (
                <p key={item} className="mt-1 text-muted-foreground">
                  {item}
                </p>
              ))}
              {question.missed.map((item) => (
                <p key={item} className="mt-1">
                  {item}
                </p>
              ))}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
