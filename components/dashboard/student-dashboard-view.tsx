"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Layers,
  Play,
  Send,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StudentDashboardFullView } from "@/lib/services/dashboard";
import type { ClassroomAnalyticsSummary } from "@/lib/services/classroom-analytics";
import { formatMastery } from "@/lib/engine/dashboard-bands";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function StudentDashboardView({
  view,
}: {
  view: StudentDashboardFullView;
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  const [activeTab, setActiveTab] = useState<
    "mastery" | "focus" | "assessments" | "leaderboard" | "roadmap"
  >("mastery");
  const [leaderboardType, setLeaderboardType] = useState<"course" | "assignment">("course");

  // AI Mentor state
  const [mentorInput, setMentorInput] = useState("");
  const [mentorMessages, setMentorMessages] = useState<
    { role: "user" | "assistant"; content: string; mode?: "model" | "simulated" }[]
  >([
    {
      role: "assistant",
      content: `Hello ${view.student.name}! I am your AI Learning Mentor. You are currently exploring **${view.currentFocus?.conceptName ?? "Core Concepts"}**. Ask me anything, or click a quick prompt below to clarify concepts, review prerequisites, or get hints!`,
      mode: "simulated",
    },
  ]);
  const [isMentorPending, setIsMentorPending] = useState(false);

  async function handleSendMentor(promptText?: string, action: "explain" | "simplify" | "hint" | "example" | "freeform" = "freeform") {
    const textToSend = promptText ?? mentorInput.trim();
    if (!textToSend && action === "freeform") return;

    const newHistory = [...mentorMessages, { role: "user" as const, content: textToSend }];
    setMentorMessages(newHistory);
    setMentorInput("");
    setIsMentorPending(true);

    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conceptName: view.currentFocus?.conceptName ?? "Software Engineering",
          lessonTitle: view.module?.name ?? "Full Stack Development",
          action,
          question: action === "freeform" ? textToSend : undefined,
          history: mentorMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        data?: { reply: string; mode: "model" | "simulated" };
        error?: { message?: string };
      };

      if (!response.ok || !body.data) {
        setMentorMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: body.error?.message ?? "I could not answer right now. Please try again shortly.",
            mode: "simulated",
          },
        ]);
        return;
      }

      setMentorMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: body.data!.reply,
          mode: body.data!.mode,
        },
      ]);
    } catch {
      setMentorMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error contacting mentor. Please check your connection.",
          mode: "simulated",
        },
      ]);
    } finally {
      setIsMentorPending(false);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header & Quick Context */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-border/60 pb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Student Learning Workspace
            </span>
            {view.batch ? (
              <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Cohort: {view.batch.name}
              </span>
            ) : null}
            {view.module ? (
              <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Course: {view.module.name}
              </span>
            ) : null}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {view.student.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your course roadmap mastery, review graded submissions, and consult your contextual AI Mentor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
            <Link href={view.module?.id ? `/curriculum?moduleId=${view.module.id}` : "/curriculum"}>
              <Compass className="size-3.5" />
              <span>Explore Concept Map</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
            <Link href={view.module?.id ? `/practice?moduleId=${view.module.id}` : "/practice"}>
              <Play className="size-3.5" />
              <span>Practice Lab</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* 2. Visual Metric Cards (Top Section with Direct Redirection) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your Path at a Glance
          </h2>
          <span className="text-xs text-muted-foreground">Live Telemetry & Real-Time Performance</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Course Completion -> redirects to Concept Map */}
          <Link
            href={view.module?.id ? `/curriculum?moduleId=${view.module.id}` : "/curriculum"}
            className="group rounded-xl border border-border/80 bg-card p-4.5 shadow-xs flex flex-col justify-between hover:border-emerald-500/60 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Course Completion
                </span>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5 font-medium">
                  <span>Concept Map</span>
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Target className="size-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {Math.round(view.overview.courseCompletionRate * 100)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({view.overview.masteredConcepts}/{view.overview.totalConcepts} concepts)
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.round(view.overview.courseCompletionRate * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Threshold: {(view.module?.threshold ?? 0.8).toFixed(2)}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium group-hover:underline">
                  Open Concept Map &rarr;
                </span>
              </p>
            </div>
          </Link>

          {/* Card 2: Assignment Progress -> redirects to Practice Lab */}
          <Link
            href={view.module?.id ? `/practice?moduleId=${view.module.id}` : "/practice"}
            className="group rounded-xl border border-border/80 bg-card p-4.5 shadow-xs flex flex-col justify-between hover:border-blue-500/60 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Assignment Progress
                </span>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 mt-0.5 font-medium">
                  <span>Practice Lab</span>
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="size-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {view.assignments.completedCount} / {view.assignments.totalCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({Math.round(view.assignments.completionRate * 100)}% done)
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.round(view.assignments.completionRate * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>{view.assignments.passRate !== null ? `Pass rate: ${Math.round(view.assignments.passRate * 100)}%` : "Practice lab tasks"}</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                  Launch Practice Lab &rarr;
                </span>
              </p>
            </div>
          </Link>

          {/* Card 3: Cohort Leaderboard -> opens Leaderboard Tab & scrolls */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("leaderboard");
              const el = document.getElementById("student-tabs-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="group rounded-xl border border-border/80 bg-card p-4.5 shadow-xs flex flex-col justify-between hover:border-amber-500/60 hover:shadow-md transition-all cursor-pointer text-left w-full"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Cohort Leaderboard
                </span>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 mt-0.5 font-medium">
                  <span>{view.batch?.name ?? "Batch Standings"}</span>
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Trophy className="size-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  #{view.leaderboard.currentStudentRanks.courseRank}
                </span>
                <span className="text-xs text-muted-foreground">
                  of {view.leaderboard.currentStudentRanks.courseTotal} students
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold">
                  Top {Math.max(1, Math.round((view.leaderboard.currentStudentRanks.courseRank / Math.max(view.leaderboard.currentStudentRanks.courseTotal, 1)) * 100))}% in Cohort
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Score: {view.leaderboard.course.find((c) => c.isCurrentStudent)?.score ?? 0} pts</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium group-hover:underline">
                  View Standings &rarr;
                </span>
              </p>
            </div>
          </button>

          {/* Card 4: Assessment Lab -> redirects to Online Assessment Workspace */}
          <Link
            href="/assessment"
            className="group rounded-xl border border-border/80 bg-card p-4.5 shadow-xs flex flex-col justify-between hover:border-purple-500/60 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Assessment Lab
                </span>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-0.5 mt-0.5 font-medium">
                  <span>OA Workspace</span>
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <Award className="size-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {view.attempts.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  Graded Submissions
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold">
                  {view.attempts.filter((a) => (a.passRate ?? 0) >= 0.8).length} Evaluations Passed
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Pass Rate: {view.assignments.passRate !== null ? `${Math.round(view.assignments.passRate * 100)}%` : "100%"}</span>
                <span className="text-purple-600 dark:text-purple-400 font-medium group-hover:underline">
                  Take Assessment &rarr;
                </span>
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* 3. Recommended Next Steps (Adaptive Banner / Hero) */}
      {view.nextAction ? (
        <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-secondary/30 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-xs">
                  <Sparkles className="size-3.5" />
                  {view.nextAction.badgeLabel}
                </span>
                <span className="text-xs font-medium text-muted-foreground font-mono">
                  Concept: {view.currentFocus?.conceptName}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {view.nextAction.activityTitle}
              </h2>
              <p className="text-sm text-foreground/80 leading-relaxed text-pretty">
                {view.nextAction.reason}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button asChild size="lg" className="h-11 px-5 gap-2 font-semibold shadow-xs">
                <Link href={view.nextAction.href}>
                  <span>{view.nextAction.actionLabel}</span>
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-4 gap-2 font-semibold">
                <Link href={view.module?.id ? `/curriculum?moduleId=${view.module.id}` : "/curriculum"}>
                  <Compass className="size-4" />
                  <span>Explore Concept Map</span>
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* 4. Interactive Tabs Section */}
      <section id="student-tabs-section" className="space-y-4">
        {/* Tab Controls */}
        <div className="flex flex-wrap border-b border-border/70 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("mastery")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors",
              activeTab === "mastery"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers className="size-4" />
            <span>Concept Master by Student</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
              {view.concepts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("focus")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors",
              activeTab === "focus"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Target className="size-4" />
            <span>Current Focus Topic</span>
            {view.currentFocus ? (
              <span className="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-mono">
                {view.currentFocus.conceptName}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assessments")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors",
              activeTab === "assessments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <CheckCircle2 className="size-4" />
            <span>Graded Assessments</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
              {view.attempts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors",
              activeTab === "leaderboard"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Trophy className="size-4" />
            <span>Cohort Leaderboard</span>
            <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-mono font-bold">
              #{view.leaderboard.currentStudentRanks.courseRank}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roadmap")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors",
              activeTab === "roadmap"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Compass className="size-4" />
            <span>Course Roadmap DAG</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
              {view.roadmapChart.length} Steps
            </span>
          </button>
        </div>

        {/* Tab 1: Concept Master */}
        {activeTab === "mastery" && (
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Module Syllabus & Concept Status
                </h3>
                <p className="text-xs text-muted-foreground">
                  Adaptive knowledge mastery estimates. Threshold is{" "}
                  {(view.module?.threshold ?? 0.8).toFixed(2)}.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" /> Mastered (Solid)
                </span>
                <span className="inline-flex items-center gap-1.5 ml-2">
                  <span className="size-2 rounded-full bg-amber-500" /> Below Threshold
                </span>
                <span className="inline-flex items-center gap-1.5 ml-2">
                  <span className="size-2 rounded-full bg-muted-foreground/40" /> Not Recorded
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                    <th className="py-2.5 px-3.5">Concept</th>
                    <th className="py-2.5 px-3.5">Mastery Band</th>
                    <th className="py-2.5 px-3.5">Score (pKnow)</th>
                    <th className="py-2.5 px-3.5">Confidence</th>
                    <th className="py-2.5 px-3.5">Prerequisites</th>
                    <th className="py-2.5 px-3.5">Latest Update</th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {view.concepts.map((concept) => (
                    <tr key={concept.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3.5 font-medium text-foreground">
                        <Link
                          href={
                            view.module?.id
                              ? `/learn?moduleId=${view.module.id}&conceptId=${concept.id}`
                              : `/learn?conceptId=${concept.id}`
                          }
                          className="group/concept inline-flex items-center gap-1.5 hover:text-primary transition-colors font-semibold"
                        >
                          <span>{concept.name}</span>
                          <ArrowUpRight className="size-3 text-primary opacity-0 group-hover/concept:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border",
                            concept.band === "solid"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                              : concept.band === "below_threshold"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                : "bg-muted/60 text-muted-foreground border-border/60",
                          )}
                        >
                          {concept.band === "solid"
                            ? "Solid"
                            : concept.band === "below_threshold"
                              ? "Developing"
                              : "Not Recorded"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-xs">
                        {concept.pKnow !== null ? (
                          <span className="font-semibold text-foreground">
                            {formatMastery(concept.pKnow)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unrecorded</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-xs text-muted-foreground">
                        {concept.confidenceLabel}
                      </td>
                      <td className="py-3 px-3.5 text-xs text-muted-foreground max-w-[20rem]">
                        {concept.prerequisites.length === 0 ? (
                          <span className="text-muted-foreground">None (Foundational)</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {concept.prerequisites.map((p) => (
                              <span
                                key={p.name}
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium border",
                                  p.state === "met"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
                                )}
                              >
                                {p.name}: {p.state === "met" ? "Met" : "Below"}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-xs text-muted-foreground max-w-[22rem]">
                        {concept.latestUpdate ? (
                          <span>
                            {concept.latestUpdate.causeType} shifted {concept.latestUpdate.before.toFixed(2)} &rarr; {concept.latestUpdate.after.toFixed(2)}
                          </span>
                        ) : (
                          <span>Baseline estimate</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <Button asChild size="sm" variant="ghost" className="h-7 text-xs font-semibold gap-1 hover:text-primary">
                          <Link
                            href={
                              view.module?.id
                                ? `/learn?moduleId=${view.module.id}&conceptId=${concept.id}`
                                : `/learn?conceptId=${concept.id}`
                            }
                          >
                            <BookOpen className="size-3" />
                            <span>Learn</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Current Focus */}
        {activeTab === "focus" && (
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-5">
            {view.currentFocus ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Adaptive Active Selection
                    </span>
                    <h3 className="text-xl font-bold text-foreground">
                      {view.currentFocus.conceptName}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" className="gap-1.5 font-semibold shadow-xs">
                      <Link
                        href={
                          view.module?.id && view.currentFocus.conceptId
                            ? `/learn?moduleId=${view.module.id}&conceptId=${view.currentFocus.conceptId}`
                            : "/learn"
                        }
                      >
                        <BookOpen className="size-3.5" />
                        <span>Study {view.currentFocus.conceptName} in Learning Module</span>
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
                      <Link
                        href={
                          view.module?.id && view.currentFocus.conceptId
                            ? `/practice?moduleId=${view.module.id}&conceptId=${view.currentFocus.conceptId}`
                            : view.module?.id
                              ? `/practice?moduleId=${view.module.id}`
                              : "/practice"
                        }
                      >
                        <Play className="size-3.5" />
                        <span>Practice Lab</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Pedagogical Selection Rationale
                  </p>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {view.currentFocus.reason}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-4 bg-background/50 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Stored Mastery vs Prediction
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stored Mastery:</span>
                      <span className="font-mono font-bold text-foreground">
                        {view.currentFocus.storedMastery !== null
                          ? formatMastery(view.currentFocus.storedMastery)
                          : "Not recorded"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Predicted Success Chance:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {view.currentFocus.predictedSuccess !== null
                          ? formatMastery(view.currentFocus.predictedSuccess)
                          : "Uncalibrated"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-background/50 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Prerequisite Readiness Checklist
                    </p>
                    {view.currentFocus.prerequisites.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Foundational topic &bull; No prerequisite blockers required.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-xs">
                        {view.currentFocus.prerequisites.map((prereq) => (
                          <li
                            key={prereq.id}
                            className="flex items-center justify-between rounded border border-border/60 bg-card p-2"
                          >
                            <span className="font-medium text-foreground">{prereq.name}</span>
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-[10px] font-semibold border",
                                prereq.ready
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                              )}
                            >
                              {prereq.ready ? "Ready (≥ 0.80)" : "Blocking (< 0.80)"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {view.currentFocus.alternatives.length > 0 ? (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Alternative Concepts Considered
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {view.currentFocus.alternatives.map((alt) => (
                        <div key={alt.name} className="rounded-lg border border-border/70 p-3 text-xs bg-muted/20">
                          <p className="font-semibold text-foreground">{alt.name}</p>
                          <p className="text-muted-foreground mt-0.5">{alt.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active topic selected yet.</p>
            )}
          </div>
        )}

        {/* Tab 3: Assessments & Brief Results */}
        {activeTab === "assessments" && (
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Graded Submissions & Verification
                </h3>
                <p className="text-xs text-muted-foreground">
                  Automated sandbox test assertions evaluate pass rates. Click a statement to replay the session.
                </p>
              </div>
              <span className="rounded-md border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {view.attempts.length} Total Submissions
              </span>
            </div>

            {view.attempts.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="mx-auto size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No graded submissions on record yet</p>
                <p className="text-xs text-muted-foreground">
                  Solve coding questions in the Practice Lab or take an Online Assessment to record your test pass rates.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full min-w-[44rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                      <th className="py-2.5 px-3.5">When</th>
                      <th className="py-2.5 px-3.5">Question Statement</th>
                      <th className="py-2.5 px-3.5">Hidden Tests</th>
                      <th className="py-2.5 px-3.5">Pass Rate</th>
                      <th className="py-2.5 px-3.5">Explanation Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {view.attempts.map((att) => (
                      <tr key={att.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {att.at}
                        </td>
                        <td className="py-3 px-3.5">
                          {att.replayHref ? (
                            <Link
                              href={att.replayHref}
                              className="font-medium text-primary hover:underline underline-offset-4"
                            >
                              {att.statement}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground">{att.statement}</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-xs font-semibold text-foreground">
                          {att.passed !== null && att.total !== null
                            ? `${att.passed}/${att.total} passed`
                            : "Recorded"}
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold font-mono",
                              (att.passRate ?? 0) >= 0.8
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                            )}
                          >
                            {att.passRate !== null ? formatMastery(att.passRate) : "Pending"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-xs text-muted-foreground max-w-[20rem]">
                          {att.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Cohort Leaderboard */}
        {activeTab === "leaderboard" && (
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">
                  <Trophy className="size-3.5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Batch Cohort Standings
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {view.batch?.name ?? "Autonomous Cohort"} rankings across course mastery and practice assignments
                  </p>
                </div>
              </div>

              {/* Toggle between Course and Assignment Leaderboard */}
              <div className="flex rounded-md border border-border/70 p-0.5 bg-muted/30 text-xs">
                <button
                  type="button"
                  onClick={() => setLeaderboardType("course")}
                  className={cn(
                    "rounded px-2.5 py-1 font-semibold transition-colors",
                    leaderboardType === "course"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Course Mastery
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardType("assignment")}
                  className={cn(
                    "rounded px-2.5 py-1 font-semibold transition-colors",
                    leaderboardType === "assignment"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Assignments
                </button>
              </div>
            </div>

            {leaderboardType === "course" ? (
              <div className="space-y-2">
                {view.leaderboard.course.map((student) => (
                  <div
                    key={student.studentId}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition-colors text-xs",
                      student.isCurrentStudent
                        ? "border-primary/50 bg-primary/5 font-semibold"
                        : "border-border/60 bg-background/50 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs font-bold font-mono",
                          student.rank === 1
                            ? "bg-amber-400 text-amber-950"
                            : student.rank === 2
                              ? "bg-slate-300 text-slate-800"
                              : student.rank === 3
                                ? "bg-amber-700 text-amber-100"
                                : "bg-muted text-muted-foreground",
                        )}
                      >
                        {student.rank}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{student.name}</span>
                          {student.isCurrentStudent ? (
                            <span className="rounded bg-primary/20 text-primary px-1.5 py-0.2 text-[9px] font-bold">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-normal">
                          {student.masteredCount} concepts mastered
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-primary">
                        {student.score} pts
                      </p>
                      <p className="text-[10px] text-muted-foreground">Mastery Score</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {view.leaderboard.assignment.map((student) => (
                  <div
                    key={student.studentId}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition-colors text-xs",
                      student.isCurrentStudent
                        ? "border-primary/50 bg-primary/5 font-semibold"
                        : "border-border/60 bg-background/50 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs font-bold font-mono",
                          student.rank === 1
                            ? "bg-amber-400 text-amber-950"
                            : student.rank === 2
                              ? "bg-slate-300 text-slate-800"
                              : student.rank === 3
                                ? "bg-amber-700 text-amber-100"
                                : "bg-muted text-muted-foreground",
                        )}
                      >
                        {student.rank}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{student.name}</span>
                          {student.isCurrentStudent ? (
                            <span className="rounded bg-primary/20 text-primary px-1.5 py-0.2 text-[9px] font-bold">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-normal">
                          {student.submissionsCount} submissions &bull; {student.assertionsPassed} tests passed
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {student.score} pts
                      </p>
                      <p className="text-[10px] text-muted-foreground">Evaluation Score</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Course Roadmap DAG */}
        {activeTab === "roadmap" && (
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
                    📈
                  </span>
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    Roadmap Concept Mastery Progress
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Concepts ordered by topological DAG prerequisites. Green line represents the {(view.module?.threshold ?? 0.8) * 100}% mastery threshold.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  Goal: {view.module?.goalName ?? "Course Goal"}
                </span>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs font-semibold gap-1">
                  <Link href={view.module?.id ? `/curriculum?moduleId=${view.module.id}` : "/curriculum"}>
                    <Compass className="size-3" />
                    <span>Open Concept Map</span>
                  </Link>
                </Button>
              </div>
            </div>

            {view.roadmapChart.length > 0 ? (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={view.roadmapChart}
                      margin={{ top: 12, right: 16, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="roadmapTabGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis
                        dataKey="name"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        unit="%"
                      />
                      <ReferenceLine
                        y={Math.round((view.module?.threshold ?? 0.8) * 100)}
                        stroke="var(--emerald-500, #10b981)"
                        strokeDasharray="4 4"
                        label={{
                          value: `Threshold ${Math.round((view.module?.threshold ?? 0.8) * 100)}%`,
                          fill: "var(--emerald-500, #10b981)",
                          fontSize: 10,
                          position: "insideTopRight",
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0].payload as StudentDashboardFullView["roadmapChart"][number];
                          return (
                            <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-md">
                              <p className="font-bold text-foreground">{item.name}</p>
                              <p className="text-muted-foreground mt-1">
                                Status: <span className="font-semibold text-primary">{item.status}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Mastery: <span className="font-mono font-bold text-foreground">{item.mastery}%</span>
                              </p>
                              <p className="text-muted-foreground">
                                Confidence: <span className="font-mono">{item.confidenceLabel}</span>
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="mastery"
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#roadmapTabGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Step milestones below chart */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 pt-2">
                  {view.roadmapChart.map((node) => (
                    <Link
                      key={node.conceptId}
                      href={
                        view.module?.id
                          ? `/learn?moduleId=${view.module.id}&conceptId=${node.conceptId}`
                          : `/learn?conceptId=${node.conceptId}`
                      }
                      className="group rounded-lg border border-border/70 p-3 bg-muted/20 flex flex-col justify-between hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Step {node.step}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-semibold border",
                            node.status === "Mastered"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : node.status === "In Progress"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {node.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {node.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                        <span>Score: {node.mastery}%</span>
                        <span className="text-[10px] text-primary font-semibold group-hover:underline">Learn &rarr;</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No concepts assigned to module roadmap.</p>
            )}
          </div>
        )}
      </section>

      {/* 5. AI Mentor & Recent Activity Section (Side-by-Side on Desktop) */}
      <section className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Embedded AI Mentor Section */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between min-h-[26rem]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold">
                  <Sparkles className="size-3.5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Contextual AI Learning Mentor
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Grounded in: <span className="font-semibold text-primary">{view.currentFocus?.conceptName ?? "Current Course"}</span>
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 border border-emerald-500/20">
                Online
              </span>
            </div>

            {/* Quick action chips */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSendMentor(undefined, "explain")}
                className="rounded-full border border-border/80 bg-background/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors"
              >
                💡 Explain this concept
              </button>
              <button
                type="button"
                onClick={() => handleSendMentor(undefined, "simplify")}
                className="rounded-full border border-border/80 bg-background/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors"
              >
                🧩 Explain more simply
              </button>
              <button
                type="button"
                onClick={() => handleSendMentor(undefined, "hint")}
                className="rounded-full border border-border/80 bg-background/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors"
              >
                🔍 Give me a hint
              </button>
              <button
                type="button"
                onClick={() => handleSendMentor(undefined, "example")}
                className="rounded-full border border-border/80 bg-background/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors"
              >
                💻 Real-world example
              </button>
            </div>

            {/* Messages container */}
            <div className="max-h-60 overflow-y-auto space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
              {mentorMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg p-2.5 space-y-1",
                    msg.role === "user"
                      ? "ml-8 bg-primary text-primary-foreground font-medium"
                      : "mr-8 bg-card border border-border text-foreground",
                  )}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                  {msg.mode && msg.role === "assistant" ? (
                    <span className="block text-[9px] text-muted-foreground/70 font-mono">
                      {msg.mode === "model" ? "Generative mentor response" : "Deterministic mentor guidance"}
                    </span>
                  ) : null}
                </div>
              ))}
              {isMentorPending ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                  <span className="size-2 rounded-full bg-primary animate-ping" />
                  <span>Mentor is formulating advice…</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Mentor Input form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMentor();
            }}
            className="flex items-center gap-2 pt-3 border-t border-border/60"
          >
            <input
              type="text"
              value={mentorInput}
              onChange={(e) => setMentorInput(e.target.value)}
              placeholder={`Ask a question about ${view.currentFocus?.conceptName ?? "this topic"}…`}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isMentorPending || !mentorInput.trim()}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Send className="size-3" />
              <span>Ask</span>
            </Button>
          </form>
        </div>

        {/* Recent Activity Feed */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-4 min-h-[26rem] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground">Recent Learning Activity</h3>
              </div>
              <span className="text-xs text-muted-foreground">Unified Action History</span>
            </div>

            {view.activityFeed.length === 0 ? (
              <p className="text-xs text-muted-foreground pt-4">No recent learning events recorded yet.</p>
            ) : (
              <div className="divide-y divide-border/60 text-xs">
                {view.activityFeed.slice(0, 7).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2.5 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                          item.type === "submission"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : item.type === "lesson"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {item.type === "submission" ? "💻" : item.type === "lesson" ? "📖" : "⚡"}
                      </span>
                      <div>
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="font-medium text-foreground hover:underline hover:text-primary truncate max-w-xs sm:max-w-sm block"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          <p className="font-medium text-foreground truncate max-w-xs sm:max-w-sm">{item.title}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      {item.badge ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
                          {item.badge}
                        </span>
                      ) : null}
                      <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {item.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Synchronized with autonomous session telemetry</span>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={view.module?.id ? `/practice?moduleId=${view.module.id}` : "/practice"}>
                <span>Continue Practice</span>
                <ChevronRight className="size-3 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
