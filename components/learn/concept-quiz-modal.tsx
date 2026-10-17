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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConceptQuiz } from "@/lib/services/learn-module";

export function ConceptQuizModal({
  quiz,
  lessonId,
  onClose,
}: {
  quiz: ConceptQuiz;
  lessonId?: string | null;
  onClose: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = quiz.questions[currentIdx];
  const total = quiz.questions.length;
  const isSelected = selectedAnswers[currentIdx] !== undefined;
  const selectedOption = selectedAnswers[currentIdx];
  const isCorrect = isSelected && selectedOption === currentQ.answerIndex;

  const handleSelectOption = (optIdx: number) => {
    if (showExplanation[currentIdx]) return; // lock once answered
    setSelectedAnswers((prev) => ({ ...prev, [currentIdx]: optIdx }));
    setShowExplanation((prev) => ({ ...prev, [currentIdx]: true }));
  };

  const handleNext = () => {
    if (currentIdx < total - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setIsFinished(true);
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
  };

  // Calculate diagnostic results
  let correctCount = 0;
  for (let i = 0; i < total; i++) {
    if (selectedAnswers[i] === quiz.questions[i].answerIndex) {
      correctCount++;
    }
  }
  const scorePercent = Math.round((correctCount / total) * 100);

  let standingTitle = "Novice Understanding";
  let standingColor = "text-amber-500 border-amber-500/30 bg-amber-500/10";
  let standingAdvice =
    "You are in the foundational phase of this concept. We strongly recommend reading the interactive lesson and working through the diagrams before continuing.";

  if (scorePercent >= 85) {
    standingTitle = "Mastery Standing: Solid Mastered";
    standingColor = "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
    standingAdvice =
      "Outstanding conceptual grasp! You understand the key invariants and edge cases. You are fully prepared for the Practice Lab or upcoming Online Assessments.";
  } else if (scorePercent >= 65) {
    standingTitle = "Mastery Standing: Proficient";
    standingColor = "text-primary border-primary/30 bg-primary/10";
    standingAdvice =
      "Good understanding of primary patterns. Reviewing the detailed explanations above will help reinforce subtle edge cases.";
  } else if (scorePercent >= 40) {
    standingTitle = "Mastery Standing: Developing";
    standingColor = "text-blue-500 border-blue-500/30 bg-blue-500/10";
    standingAdvice =
      "Developing baseline understanding. Re-reading the lesson scenes and testing sample snippets in Practice will accelerate your mastery.";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl backdrop-blur-xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Concept Understanding Quiz
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
        <div className="p-6 max-h-[75vh] overflow-y-auto no-scrollbar">
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
                      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-all shadow-xs ${optStyles}`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          isAnswered && isThisCorrect
                            ? "bg-emerald-500 text-white"
                            : isAnswered && isThisSelected
                              ? "bg-destructive text-white"
                              : "bg-muted text-muted-foreground"
                        }`}
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
                  className={`rounded-xl border p-4 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 ${
                    isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  }`}
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
            /* Final Diagnostic Results Summary */
            <div className="space-y-6 text-center py-2 animate-in zoom-in-95 duration-200">
              <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1 shadow-inner">
                <Award className="size-7" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-bold tracking-tight text-foreground">
                  Diagnostic Quiz Complete
                </h4>
                <p className="text-xs text-muted-foreground">
                  Assessment of student mastery standing on{" "}
                  <span className="font-semibold text-foreground">{quiz.conceptName}</span>
                </p>
              </div>

              {/* Score Metric Card */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-muted/30 p-5 shadow-xs">
                <span className="text-4xl font-extrabold font-mono tracking-tight text-foreground">
                  {scorePercent}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {correctCount} of {total} concept checks answered correctly
                </span>

                <div
                  className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${standingColor}`}
                >
                  <Sparkles className="size-3.5" />
                  <span>{standingTitle}</span>
                </div>
              </div>

              {/* Advisory Insight */}
              <div className="rounded-xl border border-border/70 bg-card p-4 text-left shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Mastery Diagnostic Feedback
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{standingAdvice}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={handleRestart} className="gap-2">
                  <RotateCcw className="size-3.5" />
                  <span>Retake Quiz</span>
                </Button>

                {lessonId ? (
                  <Button asChild variant="secondary" size="sm" className="gap-2">
                    <Link href={`/learn/${lessonId}`}>
                      <BookOpen className="size-3.5" />
                      <span>Read Interactive Lesson</span>
                    </Link>
                  </Button>
                ) : null}

                <Button asChild size="sm" className="gap-2">
                  <Link href="/practice">
                    <Code2 className="size-3.5" />
                    <span>Practice in Code Lab</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!isFinished ? (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3.5">
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
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!showExplanation[currentIdx]}
                className="text-xs gap-1.5"
              >
                <span>{currentIdx === total - 1 ? "Complete Quiz" : "Next Question"}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end border-t border-border/60 bg-muted/20 px-6 py-3">
            <Button size="sm" onClick={onClose} className="text-xs">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
