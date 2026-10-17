"use client";

import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  FileText,
  History,
  Lightbulb,
  Sparkles,
  Tag,
  XCircle,
} from "lucide-react";
import type { PracticeQuestionDetail } from "@/lib/services/practice";

interface ProblemDescriptionProps {
  question: PracticeQuestionDetail;
  onRestoreCode?: (code: string, language: string) => void;
  isAssessment?: boolean;
}

export function ProblemDescription({
  question,
  onRestoreCode,
  isAssessment = false,
}: ProblemDescriptionProps) {
  const [activeTab, setActiveTab] = useState<"description" | "editorial" | "submissions">("description");
  const [openHintIndex, setOpenHintIndex] = useState<number | null>(null);

  const isSolved = question.status === "solved";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      {/* Top Tab Bar (LeetCode Style) */}
      <div className="flex items-center gap-1 border-b border-border/70 bg-muted/40 px-3 py-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("description")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            activeTab === "description"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
          }`}
        >
          <FileText className="size-3.5 text-primary" />
          <span>Description</span>
        </button>

        {!isAssessment ? (
          <button
            type="button"
            onClick={() => setActiveTab("editorial")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              activeTab === "editorial"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            <Lightbulb className="size-3.5 text-amber-500" />
            <span>Editorial</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setActiveTab("submissions")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            activeTab === "submissions"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
          }`}
        >
          <History className="size-3.5 text-emerald-500" />
          <span>Submissions</span>
          {question.pastSubmissions.length > 0 ? (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
              {question.pastSubmissions.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === "description" ? (
          <>
            {/* Header: Title & Badges */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-muted-foreground">
                  {question.number}.
                </span>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {question.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Difficulty Pill */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                    question.difficultyLabel === "Easy"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : question.difficultyLabel === "Medium"
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {question.difficultyLabel}
                </span>

                {/* Concept Tag */}
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  <Tag className="size-3" />
                  {question.conceptName}
                </span>

                {/* Module Badge */}
                <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <BookOpen className="size-3" />
                  {question.moduleName}
                </span>

                {/* Solved Status */}
                {isSolved ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    Solved
                  </span>
                ) : null}
              </div>
            </div>

            {/* Problem Statement */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 leading-relaxed text-sm text-foreground space-y-2">
              <p className="font-normal text-[13.5px] leading-relaxed">
                {question.statement}
              </p>
            </div>

            {/* Examples (LeetCode Example Boxes) */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Examples
              </h3>

              {question.examples.map((example, index) => (
                <div
                  key={example.id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-2 text-xs"
                >
                  <p className="font-semibold text-foreground">Example {index + 1}:</p>
                  <div className="space-y-1.5 rounded-lg bg-zinc-950 p-3 font-mono text-xs border border-zinc-800 text-zinc-200">
                    <div>
                      <span className="text-zinc-500 select-none">Input: </span>
                      <span className="text-amber-300">{example.input || "(empty)"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 select-none">Output: </span>
                      <span className="text-emerald-400">{example.output}</span>
                    </div>
                    {example.explanation ? (
                      <div className="pt-1 text-[11px] font-sans text-zinc-400 border-t border-zinc-800/80">
                        <span className="font-semibold text-zinc-300">Explanation: </span>
                        {example.explanation}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Constraints */}
            {question.constraints.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Constraints
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground rounded-xl border border-border/60 bg-muted/20 p-3.5 font-mono">
                  {question.constraints.map((constraint, i) => (
                    <li key={i} className="text-[12px] text-foreground/80">
                      <code>{constraint}</code>
                    </li>
                  ))}
                  <li className="text-[11px] text-muted-foreground italic font-sans list-none pt-1">
                    • Mode: Practice & Ungraded — Run code as many times as you like.
                  </li>
                </ul>
              </div>
            ) : null}

            {/* Hints Accordion */}
            {!isAssessment && question.hints.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="size-3.5 text-amber-500" />
                  Hints
                </h3>
                <div className="space-y-1.5">
                  {question.hints.map((hint, i) => {
                    const isOpen = openHintIndex === i;
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-border/70 bg-card overflow-hidden transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenHintIndex(isOpen ? null : i)}
                          className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted/50"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">Hint {i + 1}</span>
                          </span>
                          <ChevronDown
                            className={`size-3.5 text-muted-foreground transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isOpen ? (
                          <div className="border-t border-border/50 bg-muted/20 px-3.5 py-2.5 text-xs text-foreground/90 leading-relaxed">
                            {hint}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {activeTab === "editorial" && !isAssessment ? (
          <div className="space-y-5 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <Sparkles className="size-4 text-amber-500" />
              <h2 className="text-sm font-bold text-foreground">
                Editorial & Approach Guide
              </h2>
            </div>

            {/* Intuition */}
            <div className="space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-primary">
                Intuition
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {question.editorial.intuition}
              </p>
            </div>

            {/* Step-by-step Approach */}
            <div className="space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-primary">
                Algorithmic Approach
              </h3>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 whitespace-pre-line text-foreground/90 font-mono text-[11.5px] leading-relaxed">
                {question.editorial.approach}
              </div>
            </div>

            {/* Complexity Cards */}
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-primary">
                Complexity Analysis
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Time Complexity
                  </span>
                  <p className="font-mono font-semibold text-foreground">
                    {question.editorial.complexity.time}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Space Complexity
                  </span>
                  <p className="font-mono font-semibold text-foreground">
                    {question.editorial.complexity.space}
                  </p>
                </div>
              </div>
            </div>

            {/* Key Concepts */}
            {question.editorial.keyConcepts.length > 0 ? (
              <div className="space-y-1.5">
                <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-primary">
                  Relevant Concepts
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {question.editorial.keyConcepts.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "submissions" ? (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h2 className="text-sm font-bold text-foreground">
                Your Practice Submissions
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {question.pastSubmissions.length} recorded
              </span>
            </div>

            {question.pastSubmissions.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No submissions for this challenge yet. Run or submit code to test your solution!
              </div>
            ) : (
              <div className="space-y-2">
                {question.pastSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {sub.passed ? (
                        <CheckCircle2 className="size-4.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="size-4.5 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              sub.passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {sub.passed ? "Accepted" : "Wrong Answer"}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
                            {sub.kind}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {sub.language}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(sub.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onRestoreCode ? (
                        <button
                          type="button"
                          onClick={() => onRestoreCode(sub.code, sub.language)}
                          className="rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                        >
                          Load Code
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
