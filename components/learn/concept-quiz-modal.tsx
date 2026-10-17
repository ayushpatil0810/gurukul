"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Code2,
  Sparkles,
  X,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConceptQuiz } from "@/lib/services/learn-module";
import { cn } from "cn";

export function ConceptQuizModal({
  quiz,
  lessonId,
  onClose,
  onQuizCompleted,
  onOpenLearnWin,
}: {
  quiz: ConceptQuiz;
  lessonId?: string | null;
  onClose: () => void;
  onQuizCompleted?: (result: {
    conceptId: string;
    passed: boolean;
    scorePercent: number;
    correctCount: number;
    total: number;
  }) => void;
  onOpenLearnWin?: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiResponse, setApiResponse] = useState<{ passed: boolean; message?: string } | null>(null);

  const currentQ = quiz.questions[currentIdx];
  const total = quiz.questions.length;
  const isSelected = selectedAnswers[currentIdx] !== undefined;
  const selectedOption = selectedAnswers[currentIdx];
  const isCorrect = isSelected && selectedOption === currentQ.answerIndex;

  const MINIMUM_PASSING_PERCENT = quiz.passingScorePercent || 70;

  const handleSelectOption = (optIdx: number) => {
    if (showExplanation[currentIdx]) return; // lock once answered
    setSelectedAnswers((prev) => ({ ...prev, [currentIdx]: optIdx }));
    setShowExplanation((prev) => ({ ...prev, [currentIdx]: true }));
  };

  const handleNext = () => {
    if (currentIdx < total - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedAnswers({});
    setShowExplanation({});
    setIsFinished(false);
    setApiResponse(null);
  };

  const finishQuiz = async () => {
    let correct = 0;
    for (let i = 0; i < total; i++) {
      if (selectedAnswers[i] === quiz.questions[i].answerIndex) {
        correct++;
      }
    }
    const score = Math.round((correct / total) * 100);
    const passed = score >= MINIMUM_PASSING_PERCENT;

    setIsFinished(true);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/learning/concept-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: quiz.conceptId,
          scorePercent: score,
          correctCount: correct,
          totalQuestions: total,
        }),
      });
      const data = await res.json();
      setApiResponse(data);
    } catch {
      // Offline fallback
      setApiResponse({ passed, message: passed ? "Mastery saved locally" : "Retake required" });
    } finally {
      setIsSubmitting(false);
      onQuizCompleted?.({
        conceptId: quiz.conceptId,
        passed,
        scorePercent: score,
        correctCount: correct,
        total,
      });
    }
  };

  // Calculate diagnostic results
  let correctCount = 0;
  for (let i = 0; i < total; i++) {
    if (selectedAnswers[i] === quiz.questions[i].answerIndex) {
      correctCount++;
    }
  }
  const scorePercent = Math.round((correctCount / total) * 100);
  const isPassed = scorePercent >= MINIMUM_PASSING_PERCENT;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl backdrop-blur-xl flex flex-col max-h-[90vh]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Diagnostic Concept Evaluation · Minimum Pass: {MINIMUM_PASSING_PERCENT}%
              </p>
              <h3 className="text-base font-bold text-foreground leading-tight">
                {quiz.conceptName}: {quiz.title}
              </h3>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close quiz"
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto no-scrollbar flex-1">
          {!isFinished ? (
            <div className="space-y-6">
              {/* Progress Bar & Counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground font-mono">
                    Question {currentIdx + 1} of {total}
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] text-foreground">
                    Topic: {currentQ.topicFocus}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Statement */}
              <div className="space-y-3">
                <h4 className="text-base font-semibold text-foreground leading-relaxed">
                  {currentQ.question}
                </h4>

                {currentQ.codeSnippet ? (
                  <div className="overflow-x-auto rounded-lg border border-border/80 bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 shadow-inner">
                    <pre className="no-scrollbar">{currentQ.codeSnippet}</pre>
                  </div>
                ) : null}
              </div>

              {/* Multiple Choice Options */}
              <div className="space-y-2.5 pt-1">
                {currentQ.options.map((option, optIdx) => {
                  const isAnswered = showExplanation[currentIdx];
                  const isThisSelected = selectedOption === optIdx;
                  const isThisCorrect = optIdx === currentQ.answerIndex;

                  let optStyles =
                    "border-border/70 hover:border-primary/50 hover:bg-muted/40 text-foreground";
                  if (isAnswered) {
                    if (isThisCorrect) {
                      optStyles =
                        "border-emerald-500/60 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-medium";
                    } else if (isThisSelected) {
                      optStyles =
                        "border-destructive/60 bg-destructive/10 text-destructive font-medium";
                    } else {
                      optStyles = "border-border/40 opacity-60 text-muted-foreground";
                    }
                  } else if (isThisSelected) {
                    optStyles = "border-primary bg-primary/10 text-foreground font-medium";
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(optIdx)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-all shadow-xs",
                        optStyles,
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          isAnswered && isThisCorrect
                            ? "bg-emerald-500 text-white"
                            : isAnswered && isThisSelected
                              ? "bg-destructive text-white"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="flex-1 leading-relaxed pt-0.5">{option}</span>
                      {isAnswered && isThisCorrect ? (
                        <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                      ) : isAnswered && isThisSelected ? (
                        <XCircle className="size-5 shrink-0 text-destructive" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Formative Explanation Banner */}
              {showExplanation[currentIdx] ? (
                <div
                  className={cn(
                    "rounded-xl border p-4 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1",
                    isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>Correct! Formative Explanation:</span>
                      </>
                    ) : (
                      <>
                        <HelpCircle className="size-4 text-amber-500" />
                        <span>Conceptual Explanation:</span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5">{currentQ.explanation}</p>
                </div>
              ) : null}
            </div>
          ) : (
            /* -------------------------------------------------------------------------- */
            /*                             RESULTS SCREEN                                 */
            /* -------------------------------------------------------------------------- */
            <div className="space-y-6 text-center py-2 animate-in zoom-in-95 duration-200">
              {/* Status Icon */}
              <div
                className={cn(
                  "inline-flex size-16 items-center justify-center rounded-2xl mb-1 shadow-inner",
                  isPassed
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                {isPassed ? <Award className="size-8" /> : <AlertTriangle className="size-8" />}
              </div>

              {/* Title & Status Header */}
              <div className="space-y-1.5">
                <h4 className="text-2xl font-bold tracking-tight text-foreground">
                  {isPassed ? "Concept Quiz Passed!" : "Quiz Failed — Minimum Score Not Met"}
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {isPassed
                    ? `Congratulations! You met the minimum passing threshold of ${MINIMUM_PASSING_PERCENT}%. Your concept mastery has been recorded.`
                    : `You scored ${scorePercent}%, which is below the mandatory passing threshold (${MINIMUM_PASSING_PERCENT}%). To ensure conceptual mastery, you must review your mistakes below and repeat the quiz.`}
                </p>
              </div>

              {/* Score Metric Card */}
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl border p-6 shadow-xs",
                  isPassed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <span
                  className={cn(
                    "text-5xl font-extrabold font-mono tracking-tight",
                    isPassed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {scorePercent}%
                </span>
                <span className="text-xs text-muted-foreground mt-1.5">
                  {correctCount} of {total} concept checks answered correctly · (Required: ≥ {MINIMUM_PASSING_PERCENT}%)
                </span>

                <div
                  className={cn(
                    "mt-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold",
                    isPassed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {isPassed ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  <span>
                    {isPassed
                      ? "Mastery Standing: Mastered"
                      : "Status: Repeat Required (Failing Standing)"}
                  </span>
                </div>
              </div>

              {/* Review of Missed Questions to "Figure Out What Happened" */}
              <div className="space-y-3 text-left">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="size-3.5 text-primary" />
                    <span>Conceptual Question Breakdown & Feedback</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {correctCount}/{total} Correct
                  </span>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {quiz.questions.map((q, qIdx) => {
                    const studentAns = selectedAnswers[qIdx];
                    const questionPassed = studentAns === q.answerIndex;

                    return (
                      <div
                        key={q.id}
                        className={cn(
                          "rounded-xl border p-3.5 text-xs space-y-2",
                          questionPassed
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-destructive/30 bg-destructive/5",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            Q{qIdx + 1}: {q.question}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0",
                              questionPassed
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-destructive/20 text-destructive",
                            )}
                          >
                            {questionPassed ? "Correct" : "Incorrect"}
                          </span>
                        </div>

                        {!questionPassed && studentAns !== undefined ? (
                          <div className="text-[11px] text-destructive flex items-start gap-1">
                            <span className="font-bold">Your Choice:</span>
                            <span>{q.options[studentAns]}</span>
                          </div>
                        ) : null}

                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-start gap-1">
                          <span className="font-bold">Correct Concept:</span>
                          <span>{q.options[q.answerIndex]}</span>
                        </div>

                        <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <span className="font-semibold text-foreground">Why: </span>
                          <span>{q.explanation}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons: Forced Repetition for Failures */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                {!isPassed ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRestart}
                      className="gap-2 bg-destructive hover:bg-destructive/90 text-white font-semibold text-xs shadow-md"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Repeat Quiz Now (Forced Retake)</span>
                    </Button>

                    {onOpenLearnWin ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onOpenLearnWin();
                        }}
                        className="gap-2 text-xs font-medium"
                      >
                        <BookOpen className="size-3.5" />
                        <span>Review Docs & Slides in LearnWin</span>
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRestart}
                      className="gap-2 text-xs"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Retake Quiz for Practice</span>
                    </Button>

                    <Button asChild size="sm" className="gap-2 text-xs font-semibold">
                      <Link href="/practice">
                        <Code2 className="size-3.5" />
                        <span>Proceed to Practice Lab</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!isFinished ? (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentIdx === 0}
              className="text-xs"
            >
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!showExplanation[currentIdx]}
                className="text-xs gap-1.5"
              >
                <span>{currentIdx === total - 1 ? "Submit & View Results" : "Next Question"}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3.5 shrink-0">
            <span className="text-[11px] text-muted-foreground">
              {isPassed ? "Mastery verified" : "Minimum 70% required to pass this concept"}
            </span>
            <Button size="sm" onClick={onClose} className="text-xs">
              {isPassed ? "Done" : "Close (Retry Pending)"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
