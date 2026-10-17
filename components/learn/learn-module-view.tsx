"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  X,
  Lock,
  Unlock,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LearnCourseData, CourseConceptItem } from "@/lib/services/learn-module";
import { ConceptQuizModal } from "@/components/learn/concept-quiz-modal";
import { LearnWinModal } from "@/components/learn/learn-win-modal";
import { formatMastery } from "@/lib/engine/dashboard-bands";
import { cn } from "cn";

export function LearnModuleView({
  data,
  selectedConceptId,
}: {
  data: LearnCourseData;
  selectedConceptId?: string;
}) {
  const router = useRouter();

  // Active Modals State
  const [selectedConceptForQuiz, setSelectedConceptForQuiz] = useState<CourseConceptItem | null>(null);
  const [selectedConceptForLearnWin, setSelectedConceptForLearnWin] = useState<CourseConceptItem | null>(null);

  // Tabs for each concept card: { [conceptId]: "learn" | "quiz" }
  const [conceptActiveTab, setConceptActiveTab] = useState<Record<string, "learn" | "quiz">>({});

  // Concept learning completion tracker (persisted in localStorage per student)
  const [learnedConceptIds, setLearnedConceptIds] = useState<Set<string>>(new Set());

  // Concept quiz results tracker (persisted in localStorage per student)
  const [quizResults, setQuizResults] = useState<Record<string, { passed: boolean; scorePercent: number }>>({});

  // Filter & Focus state
  const [filter, setFilter] = useState<"all" | "learning" | "mastered">("all");
  const [focusedConceptId, setFocusedConceptId] = useState<string | undefined>(selectedConceptId);

  // Initialize and persist completed concepts and quiz attempts from localStorage
  useEffect(() => {
    const studentKey = data.student.id || "default";
    const storedLearned = localStorage.getItem(`gurukul_learned_${studentKey}`);
    const storedQuizzes = localStorage.getItem(`gurukul_quizzes_${studentKey}`);

    const learnedSet = new Set<string>();
    // Pre-populate already mastered concepts as learned
    for (const c of data.concepts) {
      if (c.mastery !== null && c.mastery >= (data.module?.threshold ?? 0.8)) {
        learnedSet.add(c.id);
      }
    }

    if (storedLearned) {
      try {
        const parsed = JSON.parse(storedLearned);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => learnedSet.add(id));
        }
      } catch {
        // ignore parse errors
      }
    }
    setLearnedConceptIds(learnedSet);

    if (storedQuizzes) {
      try {
        const parsed = JSON.parse(storedQuizzes);
        setQuizResults(parsed);
      } catch {
        // ignore parse errors
      }
    }
  }, [data.student.id, data.concepts, data.module?.threshold]);

  // Handle URL concept focus scrolling
  useEffect(() => {
    if (selectedConceptId) {
      setFocusedConceptId(selectedConceptId);
      const timer = setTimeout(() => {
        const el = document.getElementById(`concept-${selectedConceptId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedConceptId]);

  const focusedConcept = data.concepts.find((c) => c.id === focusedConceptId) ?? null;

  // Mark a concept as learned/studied
  const handleMarkConceptStudied = (conceptId: string) => {
    setLearnedConceptIds((prev) => {
      const next = new Set(prev);
      next.add(conceptId);
      const studentKey = data.student.id || "default";
      localStorage.setItem(`gurukul_learned_${studentKey}`, JSON.stringify([...next]));
      return next;
    });
  };

  // Toggle study status
  const handleToggleStudied = (conceptId: string) => {
    setLearnedConceptIds((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      const studentKey = data.student.id || "default";
      localStorage.setItem(`gurukul_learned_${studentKey}`, JSON.stringify([...next]));
      return next;
    });
  };

  // Record quiz result
  const handleQuizCompleted = (result: {
    conceptId: string;
    passed: boolean;
    scorePercent: number;
  }) => {
    setQuizResults((prev) => {
      const next = {
        ...prev,
        [result.conceptId]: { passed: result.passed, scorePercent: result.scorePercent },
      };
      const studentKey = data.student.id || "default";
      localStorage.setItem(`gurukul_quizzes_${studentKey}`, JSON.stringify(next));
      return next;
    });

    if (result.passed) {
      handleMarkConceptStudied(result.conceptId);
    }
  };

  // Set card active tab
  const setCardTab = (conceptId: string, tab: "learn" | "quiz") => {
    setConceptActiveTab((prev) => ({ ...prev, [conceptId]: tab }));
  };

  const filteredConcepts = useMemo(() => {
    return data.concepts.filter((concept) => {
      const quizRes = quizResults[concept.id];
      const isMastered = concept.understandingStanding === "Mastered" || quizRes?.passed;
      if (filter === "mastered") return isMastered;
      if (filter === "learning") return !isMastered;
      return true;
    });
  }, [data.concepts, filter, quizResults]);

  return (
    <div className="space-y-8">
      {/* Quiz Modal */}
      {selectedConceptForQuiz ? (
        <ConceptQuizModal
          quiz={selectedConceptForQuiz.quiz}
          lessonId={selectedConceptForQuiz.lesson?.id}
          onClose={() => setSelectedConceptForQuiz(null)}
          onQuizCompleted={handleQuizCompleted}
          onOpenLearnWin={() => {
            const c = selectedConceptForQuiz;
            setSelectedConceptForQuiz(null);
            setSelectedConceptForLearnWin(c);
          }}
        />
      ) : null}

      {/* LearnWin Window / Modal */}
      {selectedConceptForLearnWin ? (
        <LearnWinModal
          concept={selectedConceptForLearnWin}
          courseName={data.module?.name ?? "Course Curriculum"}
          isCompleted={learnedConceptIds.has(selectedConceptForLearnWin.id)}
          onClose={() => setSelectedConceptForLearnWin(null)}
          onMarkCompleted={handleMarkConceptStudied}
          onLaunchQuiz={(c) => {
            setSelectedConceptForLearnWin(null);
            setSelectedConceptForQuiz(c);
          }}
        />
      ) : null}

      {/* Selected Concept Spotlight Banner (When arriving from Concept Map redirect) */}
      {focusedConcept ? (
        <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-background to-secondary/30 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-mono font-bold text-sm shadow-xs">
              {focusedConcept.step}
            </span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/20 text-primary px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider">
                  Active Selected Concept · Step {focusedConcept.step}
                </span>
                <span className="text-xs font-semibold text-muted-foreground font-mono">
                  Standing: {focusedConcept.understandingStanding}
                </span>
                {learnedConceptIds.has(focusedConcept.id) ? (
                  <span className="rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold">
                    Studied ✓
                  </span>
                ) : null}
              </div>
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                {focusedConcept.name}
              </h2>
              <p className="text-xs text-muted-foreground line-clamp-1 max-w-xl">
                {focusedConcept.description || "Core foundational concept in this module."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => setSelectedConceptForLearnWin(focusedConcept)}
              className="gap-1.5 text-xs font-semibold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <BookOpen className="size-3.5" />
              <span>Learn Concept (Docs & Slides)</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!learnedConceptIds.has(focusedConcept.id)}
              onClick={() => setSelectedConceptForQuiz(focusedConcept)}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <HelpCircle className="size-3.5" />
              <span>Take Quiz</span>
            </Button>
            <button
              type="button"
              onClick={() => setFocusedConceptId(undefined)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-1"
              title="Dismiss focus"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Module Header Banner */}
      <header className="rounded-2xl border border-border/70 bg-gradient-to-b from-card/90 via-card/50 to-background p-6 shadow-sm md:p-8 backdrop-blur-md space-y-6">
        {/* Course Switcher Row */}
        {data.availableModules && data.availableModules.length > 1 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-border/60 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1.5 mr-1">
              <Layers className="size-3.5 text-primary" />
              <span>Switch Course:</span>
            </span>
            {data.availableModules.map((m) => {
              const isActive = m.id === data.module?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => router.push(`/learn?moduleId=${m.id}`)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 border",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  <span>{m.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m.totalConcepts} concepts
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <GraduationCap className="size-3.5" />
              <span>Curriculum Learn Module · Topological Concept Syllabus</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl text-balance">
              {data.module?.name ?? "Course Curriculum"}
            </h1>
            <p className="max-w-[75ch] text-sm text-muted-foreground leading-relaxed text-pretty">
              Master the architectural concepts of this course in sequence. Each concept is equipped with
              two dedicated tabs: <strong>1. Learn Concept</strong> (comprehensive docs & presentation slides in LearnWin)
              and <strong>2. Take the Quiz</strong> (diagnostic mastery checks unlocked once learning is completed).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Link href={`/curriculum?moduleId=${data.module?.id}`}>
                <Network className="size-3.5 text-primary" />
                <span>View Concept Map Flow</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Link href="/practice">
                <Code2 className="size-3.5 text-blue-500" />
                <span>Practice Lab</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white">
              <Link href="/assessment">
                <ShieldAlert className="size-3.5" />
                <span>Online Assessment (OA)</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Course Concepts
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">
              {data.overview.totalConcepts}
            </p>
            <p className="text-[11px] text-muted-foreground">Mapped from Concept Map</p>
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
              Goal Concept
            </p>
            <p className="mt-1 text-sm font-bold text-foreground truncate">
              {data.module?.goalConceptName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Target threshold: {Math.round((data.module?.threshold ?? 0.8) * 100)}%
            </p>
          </div>
        </div>
      </header>

      {/* Concept Syllabus with Two Tabs per Concept */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Course Concepts & Learning Syllabus
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Follow each concept step-by-step: Learn the material in Tab 1, then test your knowledge in Tab 2.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All Concepts ({data.concepts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("learning")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === "learning"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Needs Study ({data.overview.developingConcepts + data.overview.unassessedConcepts})
            </button>
            <button
              type="button"
              onClick={() => setFilter("mastered")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === "mastered"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
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
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {filteredConcepts.map((concept) => {
              const hasLesson = Boolean(concept.lesson);
              const isLearned = learnedConceptIds.has(concept.id);
              const quizResult = quizResults[concept.id];
              const isMastered = concept.understandingStanding === "Mastered" || quizResult?.passed;
              const activeTab = conceptActiveTab[concept.id] || "learn";

              return (
                <article
                  key={concept.id}
                  id={`concept-${concept.id}`}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border p-5 sm:p-6 shadow-xs transition-all",
                    focusedConceptId === concept.id
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary bg-primary/5 shadow-md"
                      : "border-border/80 bg-card hover:border-primary/40 hover:shadow-md",
                  )}
                >
                  <div className="space-y-4">
                    {/* Top Row: Concept Step & Standing Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-xs font-bold">
                          {concept.step}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Step {concept.step} · Sequence
                        </span>
                        {concept.isGoal ? (
                          <span className="rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                            Goal Concept
                          </span>
                        ) : null}
                        {focusedConceptId === concept.id ? (
                          <span className="rounded bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold shadow-xs">
                            Active
                          </span>
                        ) : null}
                      </div>

                      {/* Concept Map Standing Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          isMastered
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : concept.conceptMapStatus === "Ready to Learn"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : concept.conceptMapStatus === "In Progress"
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                : "border-border/60 bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {isMastered ? <Check className="size-3" /> : null}
                        <span>{isMastered ? "Mastered" : concept.conceptMapStatus}</span>
                        {concept.mastery !== null ? (
                          <span className="font-mono ml-0.5">({formatMastery(concept.mastery)})</span>
                        ) : null}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                        {concept.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {concept.description || "Core foundational concept in this module."}
                      </p>
                    </div>

                    {/* Concept Map Graph Connections (Prerequisites & Unlocks) */}
                    <div className="space-y-1.5 pt-1 border-t border-border/50 text-[11px]">
                      {concept.prerequisites.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                            Prerequisites:
                          </span>
                          {concept.prerequisites.map((prereq) => (
                            <span
                              key={prereq.id}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium",
                                prereq.met
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-border/60 bg-muted text-muted-foreground",
                              )}
                            >
                              <span>{prereq.name}</span>
                              {prereq.met ? <Check className="size-2.5 text-emerald-500" /> : null}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground font-medium">
                          Foundational Concept · No prerequisites required
                        </div>
                      )}

                      {concept.unlocks.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground pt-0.5">
                          <span className="font-semibold uppercase tracking-wider text-[10px]">
                            Unlocks:
                          </span>
                          {concept.unlocks.map((u) => (
                            <span
                              key={u.id}
                              className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground/80 border border-border/60"
                            >
                              {u.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* -------------------------------------------------------------------------- */}
                    {/*                    TWO TABS PER USER REQUIREMENT                           */}
                    {/* -------------------------------------------------------------------------- */}
                    <div className="pt-2">
                      <div className="flex items-center rounded-xl border border-border/80 bg-muted/30 p-1 shadow-2xs">
                        {/* Tab 1: Should we learn the concept? */}
                        <button
                          type="button"
                          onClick={() => setCardTab(concept.id, "learn")}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                            activeTab === "learn"
                              ? "bg-background text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <BookOpen className="size-3.5 text-emerald-500" />
                          <span>1. Learn Concept</span>
                          {isLearned ? (
                            <CheckCircle2 className="size-3 text-emerald-500" />
                          ) : null}
                        </button>

                        {/* Tab 2: Should we take the quiz? */}
                        <button
                          type="button"
                          onClick={() => setCardTab(concept.id, "quiz")}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                            activeTab === "quiz"
                              ? "bg-background text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {!isLearned ? (
                            <Lock className="size-3 text-muted-foreground" />
                          ) : (
                            <HelpCircle className="size-3.5 text-primary" />
                          )}
                          <span>2. Take the Quiz</span>
                          {!isLearned ? (
                            <span className="rounded bg-muted px-1 py-0.2 text-[9px] text-muted-foreground font-mono">
                              Locked
                            </span>
                          ) : isMastered ? (
                            <CheckCircle2 className="size-3 text-emerald-500" />
                          ) : null}
                        </button>
                      </div>

                      {/* Tab 1 Content: Learn the Concept */}
                      {activeTab === "learn" ? (
                        <div className="mt-3.5 rounded-xl border border-border/70 bg-background/50 p-4 space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="size-3.5 text-primary" />
                              <span>Study: ~{concept.estimatedMinutes} mins · {concept.slides.length} Slides & Docs</span>
                            </span>
                            <span
                              className={cn(
                                "flex items-center gap-1 font-semibold text-[11px]",
                                isLearned
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {isLearned ? (
                                <>
                                  <CheckCircle2 className="size-3 text-emerald-500" />
                                  <span>Concept Studied ✓</span>
                                </>
                              ) : (
                                <span>Not Studied Yet</span>
                              )}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {concept.docs.overview}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {/* Primary CTA: Open LearnWin */}
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setSelectedConceptForLearnWin(concept)}
                              className="flex-1 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              <BookOpen className="size-3.5" />
                              <span>Open LearnWin (Docs & Slides)</span>
                            </Button>

                            {/* Mark as studied toggle */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleStudied(concept.id)}
                              className="text-xs"
                            >
                              {isLearned ? "Marked as Studied ✓" : "Mark as Studied"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Tab 2 Content: Take the Quiz */
                        <div className="mt-3.5 rounded-xl border border-border/70 bg-background/50 p-4 space-y-3 animate-in fade-in duration-150">
                          {!isLearned ? (
                            /* Locked State: Student has not learned the concept yet */
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-2">
                              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                                <Lock className="size-4" />
                                <span>Quiz Locked: Study Concept First</span>
                              </div>
                              <p className="text-xs text-muted-foreground dark:text-amber-200/80 max-w-sm mx-auto leading-relaxed">
                                To attempt this quiz, you must first complete learning the concept docs and slides in Tab 1.
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setCardTab(concept.id, "learn");
                                  setSelectedConceptForLearnWin(concept);
                                }}
                                className="mt-1 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90"
                              >
                                <BookOpen className="size-3.5" />
                                <span>Go to Tab 1 & Open LearnWin</span>
                              </Button>
                            </div>
                          ) : (
                            /* Unlocked State: Student has completed concept study */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <Clock className="size-3.5 text-primary" />
                                  <span>{concept.quiz.questions.length} Diagnostic Checks · Pass: ≥ 70%</span>
                                </span>
                                {quizResult ? (
                                  <span
                                    className={cn(
                                      "font-mono font-bold text-xs px-2 py-0.5 rounded",
                                      quizResult.passed
                                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                        : "bg-destructive/20 text-destructive",
                                    )}
                                  >
                                    Last Score: {quizResult.scorePercent}%
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1">
                                    <Unlock className="size-3" />
                                    <span>Quiz Unlocked</span>
                                  </span>
                                )}
                              </div>

                              {quizResult && !quizResult.passed ? (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-destructive font-bold">
                                    <AlertCircle className="size-4 shrink-0" />
                                    <span>Minimum 70% Mark Required</span>
                                  </div>
                                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    Your previous score of {quizResult.scorePercent}% was below the required threshold. You are required to repeat this quiz.
                                  </p>
                                </div>
                              ) : null}

                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setSelectedConceptForQuiz(concept)}
                                  className={cn(
                                    "flex-1 gap-1.5 text-xs font-semibold shadow-xs",
                                    quizResult && !quizResult.passed
                                      ? "bg-destructive hover:bg-destructive/90 text-white"
                                      : "",
                                  )}
                                >
                                  {quizResult && !quizResult.passed ? (
                                    <>
                                      <RotateCcw className="size-3.5" />
                                      <span>Repeat Quiz Now (Retake)</span>
                                    </>
                                  ) : isMastered ? (
                                    <>
                                      <RotateCcw className="size-3.5" />
                                      <span>Retake Quiz for Practice</span>
                                    </>
                                  ) : (
                                    <>
                                      <HelpCircle className="size-3.5" />
                                      <span>Take Concept Quiz</span>
                                    </>
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedConceptForLearnWin(concept)}
                                  className="text-xs"
                                >
                                  Review Docs
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Meta Bar */}
                  <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-[11px]">
                      <span>Course Map Step {concept.step}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      {hasLesson && concept.lesson ? (
                        <Link
                          href={`/learn/${concept.lesson.id}`}
                          className="hover:text-primary transition-colors flex items-center gap-1 text-[11px] font-medium"
                        >
                          <span>Fullscreen Lesson</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      ) : null}
                      <Link
                        href={`/curriculum?moduleId=${data.module?.id}&conceptId=${concept.id}`}
                        className="hover:text-primary transition-colors flex items-center gap-1 text-[11px] font-medium"
                      >
                        <span>Map Node</span>
                        <ChevronRight className="size-3" />
                      </Link>
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
          How Concept Learning, Quizzes & Mastery Standings Work
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Step 1: Learn in LearnWin</span>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Every concept offers comprehensive documentation and structured presentation slides.
              Review the architectural models and syntax to unlock the concept quiz.
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              <span>Step 2: 70% Minimum Quiz Pass</span>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Diagnostic quizzes require at least 70% to pass. If you score below 70%, you are forced
              to review your conceptual mistakes and repeat the quiz until you achieve mastery.
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>Step 3: Concept Map & OA</span>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Concepts map directly to your visual roadmap sequence. Once concepts are mastered,
              test your skills in the Practice Lab or open the dedicated Online Assessment (OA).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
