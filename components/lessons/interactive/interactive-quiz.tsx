"use client";

import { useState } from "react";
import type { PreviewQuestion } from "@/lib/engine/lesson-preview";

export function InteractiveKnowledgeCheck({
  questions,
  showAnswers = false,
  onComplete,
}: {
  questions: PreviewQuestion[];
  showAnswers?: boolean;
  onComplete?: () => void;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  function handleSelect(questionId: string, option: string) {
    if (submitted[questionId]) return; // lock selection once submitted
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  function handleSubmit(questionId: string) {
    if (!selectedAnswers[questionId]) return;
    setSubmitted((prev) => ({ ...prev, [questionId]: true }));
    // If all submitted, trigger onComplete
    const nextSubmitted = { ...submitted, [questionId]: true };
    if (questions.every((q) => nextSubmitted[q.id])) {
      onComplete?.();
    }
  }

  function handleRetry(questionId: string) {
    setSubmitted((prev) => {
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Interactive Knowledge Check</p>
        <p className="mt-0.5">
          This check is ungraded and for self-assessment. It does not alter your mastery score or assessment records.
        </p>
      </div>

      <ol className="space-y-6">
        {questions.map((question, qIdx) => {
          const isSubmitted = !!submitted[question.id];
          const selected = selectedAnswers[question.id];
          const correctAnswer = question.answer;
          // Determine if student answer matches
          const isCorrect = isSubmitted && correctAnswer && selected ? selected.trim().toLowerCase() === correctAnswer.trim().toLowerCase() : false;

          return (
            <li
              key={question.id}
              className="rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur space-y-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                  {qIdx + 1}
                </span>
                <h3 className="font-medium text-foreground text-sm text-pretty pt-0.5">
                  {question.prompt}
                </h3>
              </div>

              {/* Options */}
              {question.options.length > 0 ? (
                <div className="space-y-2 pt-1" role="radiogroup" aria-label={question.prompt}>
                  {question.options.map((option, optIdx) => {
                    const optionLetter = String.fromCharCode(65 + optIdx);
                    const isOptionSelected = selected === option;
                    const isOptionCorrectAnswer =
                      isSubmitted && correctAnswer && option.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

                    let optionStyle = "border-border bg-card hover:bg-accent/40 text-foreground";

                    if (isSubmitted) {
                      if (isOptionCorrectAnswer) {
                        optionStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-medium";
                      } else if (isOptionSelected && !isCorrect) {
                        optionStyle = "border-red-500 bg-red-500/10 text-red-900 dark:text-red-200";
                      } else {
                        optionStyle = "border-border/40 bg-muted/20 opacity-60 text-muted-foreground";
                      }
                    } else if (isOptionSelected) {
                      optionStyle = "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary";
                    }

                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={isOptionSelected}
                        disabled={isSubmitted}
                        onClick={() => handleSelect(question.id, option)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-xs transition-colors ${optionStyle}`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-current font-mono text-[10px] font-bold">
                          {optionLetter}
                        </span>
                        <span className="flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Written response question. Reflect on the answer in your own words.
                </p>
              )}

              {/* Submit & Retry Buttons */}
              <div className="flex items-center gap-3 pt-1">
                {!isSubmitted ? (
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={() => handleSubmit(question.id)}
                    className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isCorrect
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                      }`}
                    >
                      {isCorrect ? "✓ Correct" : "✕ Incorrect"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRetry(question.id)}
                      className="rounded border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>

              {/* Post-submission Feedback & Explanation */}
              {isSubmitted && correctAnswer ? (
                <div
                  className={`rounded-lg border p-3 text-xs space-y-1 animate-in fade-in duration-200 ${
                    isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200"
                      : "border-red-500/30 bg-red-500/5 text-red-950 dark:text-red-200"
                  }`}
                >
                  <p className="font-semibold">
                    {isCorrect ? "Great reasoning!" : `Key takeaway: The correct answer is “${correctAnswer}”.`}
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Readiness probes determine traffic eligibility; Kubernetes removes failing pods from LoadBalancer endpoints until health status returns to 200 OK.
                  </p>
                </div>
              ) : null}

              {/* Instructor answer key preview if explicitly enabled in studio */}
              {showAnswers && !isSubmitted && question.answer ? (
                <p className="text-xs text-muted-foreground border-t border-border pt-2 font-mono">
                  [Studio Preview Key]: {question.answer}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
