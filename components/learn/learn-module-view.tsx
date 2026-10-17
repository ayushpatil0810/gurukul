"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Code2,
  GraduationCap,
  HelpCircle,
  Layers,
  Network,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Clock,
  Check,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LearnCourseData, CourseConceptItem } from "@/lib/services/learn-module";
import { ConceptQuizModal } from "@/components/learn/concept-quiz-modal";
import { formatMastery } from "@/lib/engine/dashboard-bands";

export function LearnModuleView({ data }: { data: LearnCourseData }) {
  const [selectedConceptForQuiz, setSelectedConceptForQuiz] = useState<CourseConceptItem | null>(null);
  const [filter, setFilter] = useState<"all" | "mastered" | "learning">("all");

  const filteredConcepts = data.concepts.filter((concept) => {
    if (filter === "mastered") return concept.understandingStanding === "Mastered";
    if (filter === "learning") return concept.understandingStanding !== "Mastered";
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Quiz Modal */}
      {selectedConceptForQuiz ? (
        <ConceptQuizModal
          quiz={selectedConceptForQuiz.quiz}
          lessonId={selectedConceptForQuiz.lesson?.id}
          onClose={() => setSelectedConceptForQuiz(null)}
        />
      ) : null}

      {/* Main Module Header Banner */}
      <header className="rounded-2xl border border-border/70 bg-linear-to-b from-card/80 to-card/40 p-6 shadow-sm md:p-8 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <GraduationCap className="size-3.5" />
              <span>Independent Learn Module · Concept Syllabus</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl text-balance">
              {data.module?.name ?? "Course Curriculum"}
            </h1>
            <p className="max-w-[75ch] text-sm text-muted-foreground leading-relaxed text-pretty">
              Master the architectural concepts of this course through structured lessons, interactive
              walkthroughs, and concept-specific mastery quizzes. Quizzes diagnose your understanding
              standing to guide your learning progression.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <Link href="/curriculum">
                <Network className="size-3.5" />
                <span>Concept Map</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <Link href="/practice">
                <Code2 className="size-3.5" />
                <span>Practice Lab</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white">
              <Link href="/assessment">
                <ShieldAlert className="size-3.5" />
                <span>Online Assessment (OA)</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Course Concepts
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">
              {data.overview.totalConcepts}
            </p>
            <p className="text-[11px] text-muted-foreground">Comprehensive Syllabus</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Concepts Mastered
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {data.overview.masteredConcepts} / {data.overview.totalConcepts}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {data.overview.totalConcepts > 0
                ? `${Math.round((data.overview.masteredConcepts / data.overview.totalConcepts) * 100)}% completion`
                : "0%"}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              In Progress / Review
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {data.overview.developingConcepts + data.overview.unassessedConcepts}
            </p>
            <p className="text-[11px] text-muted-foreground">Active focus areas</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mastery Standing
            </p>
            <p className="mt-1 text-lg font-bold font-mono text-foreground truncate">
              {data.overview.averageMastery > 0
                ? formatMastery(data.overview.averageMastery)
                : "Initial"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{data.overview.standingLabel}</p>
          </div>
        </div>
      </header>

      {/* Online Assessment Isolation Callout */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-xs text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-4.5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">
              Assessment Module Isolated: Serious Fullscreen Test Environment
            </p>
            <p className="text-muted-foreground dark:text-amber-200/80 leading-relaxed">
              Formative concept learning and quizzes live here in the Learn Module. When you are ready
              for timed, proctored evaluations, open the dedicated <strong>Online Assessment (OA)</strong>{" "}
              environment via the navigation bar.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs">
          <Link href="/assessment">
            Open Assessment (OA)
          </Link>
        </Button>
      </section>

      {/* Concept Syllabus & Quiz Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Course Concepts & Diagnostic Quizzes
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Study the concepts of the course in sequence and take the diagnostic quiz for each topic.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Concepts ({data.concepts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("learning")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === "learning"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Needs Practice ({data.overview.developingConcepts + data.overview.unassessedConcepts})
            </button>
            <button
              type="button"
              onClick={() => setFilter("mastered")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === "mastered"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mastered ({data.overview.masteredConcepts})
            </button>
          </div>
        </div>

        {filteredConcepts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
            No concepts match the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredConcepts.map((concept, index) => {
              const hasLesson = Boolean(concept.lesson);
              const isMastered = concept.understandingStanding === "Mastered";
              const isProficient = concept.understandingStanding === "Proficient";
              const isDeveloping = concept.understandingStanding === "Developing";

              return (
                <article
                  key={concept.id}
                  className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    {/* Top Row: Concept Index & Standing Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold text-foreground">
                          {index + 1}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Concept {index + 1}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          isMastered
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : isProficient
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : isDeveloping
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                : "border-border/60 bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {isMastered ? <Check className="size-3" /> : null}
                        <span>{concept.understandingStanding}</span>
                        {concept.mastery !== null ? (
                          <span className="font-mono ml-0.5">({formatMastery(concept.mastery)})</span>
                        ) : null}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-lg font-bold text-foreground tracking-tight">
                        {concept.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {concept.description || "Core foundational concept in this module."}
                      </p>
                    </div>

                    {/* Prerequisites Tags */}
                    {concept.prerequisites.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Prerequisites:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {concept.prerequisites.map((prereq) => (
                            <span
                              key={prereq.id}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                                prereq.met
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-border/60 bg-muted text-muted-foreground"
                              }`}
                            >
                              <span>{prereq.name}</span>
                              {prereq.met ? <Check className="size-2.5 text-emerald-500" /> : null}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Actions: Concept Lesson & Relevant Quiz */}
                  <div className="mt-5 space-y-2.5 border-t border-border/60 pt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        <span>Quiz: ~{concept.quiz.estimatedMinutes} mins · {concept.quiz.questions.length} questions</span>
                      </span>
                      {hasLesson ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          <span>Interactive Lesson</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Take Concept Quiz Button */}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setSelectedConceptForQuiz(concept)}
                        className="flex-1 gap-1.5 text-xs font-semibold shadow-xs"
                      >
                        <HelpCircle className="size-3.5" />
                        <span>Take Concept Quiz</span>
                      </Button>

                      {/* Read Lesson Button */}
                      {hasLesson && concept.lesson ? (
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="flex-1 gap-1.5 text-xs font-medium"
                        >
                          <Link href={`/learn/${concept.lesson.id}`}>
                            <BookOpen className="size-3.5" />
                            <span>Study Lesson</span>
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Understanding Standing & Mastery Guide Section */}
      <section className="rounded-xl border border-border/80 bg-card/60 p-6 shadow-xs backdrop-blur-xs space-y-4">
        <h3 className="text-base font-bold text-foreground">
          How Quiz Mastery & Understanding Standings Work
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              <span>Formative Quiz Evaluation</span>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Every concept has a diagnostic quiz designed to assess your conceptual understanding,
              edge-case awareness, and code mental models. Instant feedback explains every answer.
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Understanding Standing</span>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Your standing progresses from <strong>Foundational</strong> to <strong>Developing</strong>,{" "}
              <strong>Proficient</strong>, and <strong>Solid Mastered</strong> as you complete lessons,
              quizzes, and coding challenges.
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>Dedicated Assessment (OA)</span>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Official mastery assessments are isolated in the Online Assessment (OA) environment,
              featuring a full-screen, focused test environment with hidden test evaluations.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
