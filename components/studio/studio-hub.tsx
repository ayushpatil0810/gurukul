"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Code2,
  AlertCircle,
  FileText,
  Lightbulb,
  ArrowRight,
  GraduationCap,
  PlayCircle,
  ChevronRight,
  HelpCircle,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

export type StudioLessonItem = {
  id: string;
  title: string;
  topic?: string;
  learnerLevel?: string;
  durationMinutes?: number;
  status: "published" | "draft";
  moduleName: string;
  conceptName: string;
  codeLanguage?: string | null;
  scenesCount?: number;
  hasScenes?: boolean;
  updatedAt: string;
};

export function StudioHub({
  lessons,
  modelConfigured,
}: {
  lessons: StudioLessonItem[];
  modelConfigured: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [showExplainer, setShowExplainer] = useState(true);

  // Extract unique concepts for filtering
  const allConcepts = useMemo(() => {
    return Array.from(new Set(lessons.map((l) => l.conceptName))).sort();
  }, [lessons]);

  // Filtered lessons
  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      const matchSearch =
        search === "" ||
        lesson.title.toLowerCase().includes(search.toLowerCase()) ||
        (lesson.topic && lesson.topic.toLowerCase().includes(search.toLowerCase())) ||
        lesson.conceptName.toLowerCase().includes(search.toLowerCase()) ||
        lesson.moduleName.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || lesson.status === statusFilter;
      const matchConcept = conceptFilter === "all" || lesson.conceptName === conceptFilter;

      return matchSearch && matchStatus && matchConcept;
    });
  }, [lessons, search, statusFilter, conceptFilter]);

  // Aggregated KPIs
  const publishedCount = lessons.filter((l) => l.status === "published").length;
  const draftCount = lessons.filter((l) => l.status === "draft").length;
  const conceptsCovered = new Set(lessons.map((l) => l.conceptName)).size;

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
            <Sparkles className="size-3 text-primary" />
            AI-Assisted Lesson Studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Interactive Lesson Studio
          </h1>
          <p className="mt-1 max-w-[65ch] text-pretty text-sm text-muted-foreground">
            Author multi-scene interactive walk-throughs, configure code examples, synthesize formative quizzes, and publish to adaptive learner paths.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/studio/new">
            <Button size="sm" className="gap-2 font-semibold shadow-xs">
              <Plus className="size-4" />
              Author New Lesson
            </Button>
          </Link>
        </div>
      </div>

      {/* TOP 4 METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Lessons */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Authored</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {lessons.length}
            </div>
            <span className="text-[11px] text-muted-foreground">in current institute</span>
          </div>
        </div>

        {/* Card 2: Published */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Live & Published</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {publishedCount}
            </div>
            <span className="text-[11px] text-muted-foreground">accessible to students</span>
          </div>
        </div>

        {/* Card 3: Drafts */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Studio Drafts</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {draftCount}
            </div>
            <span className="text-[11px] text-muted-foreground">private / in progress</span>
          </div>
        </div>

        {/* Card 4: Concepts Covered */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Concepts Covered</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {conceptsCovered}
            </div>
            <span className="text-[11px] text-muted-foreground">mapped to lessons</span>
          </div>
        </div>
      </div>

      {/* HOW LESSON STUDIO WORKS - PEDAGOGY EXPLAINER CARD */}
      {showExplainer ? (
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/2 to-card p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">
                  <Lightbulb className="size-3.5" />
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  How Lesson Studio Synthesizes Learning
                </h3>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Lesson Studio bridges concept theory and coding practice through automated 4-stage pedagogical refinement.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExplainer(false)}
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
            >
              Dismiss
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-background/80 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <span className="font-mono">01</span>
                <span>Curriculum Mapping</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Anchor the lesson to a specific prerequisite node on your knowledge graph.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                <span className="font-mono">02</span>
                <span>Outline Architecture</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Review and customize the structured scene flow: explanations, pitfalls, and checks.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                <span className="font-mono">03</span>
                <span>Syntax & Sandbox Audit</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Automated AST verification checks syntax correctness, language rules, and student safety.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <span className="font-mono">04</span>
                <span>Adaptive Delivery</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Publish privately. The lesson unlocks for learners when recommended by the BKT model.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search lessons, concepts, or modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-1 text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                statusFilter === "all"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All ({lessons.length})
            </button>
            <button
              onClick={() => setStatusFilter("published")}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                statusFilter === "published"
                  ? "bg-background text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Published ({publishedCount})
            </button>
            <button
              onClick={() => setStatusFilter("draft")}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                statusFilter === "draft"
                  ? "bg-background text-amber-700 dark:text-amber-400 font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Drafts ({draftCount})
            </button>
          </div>

          {/* Concept Filter */}
          {allConcepts.length > 0 ? (
            <select
              value={conceptFilter}
              onChange={(e) => setConceptFilter(e.target.value)}
              className="h-8 rounded-lg border border-border/70 bg-background px-3 text-xs text-foreground font-medium"
            >
              <option value="all">All Concepts ({allConcepts.length})</option>
              {allConcepts.map((concept) => (
                <option key={concept} value={concept}>
                  {concept}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {/* LESSON CARDS GRID */}
      {filteredLessons.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card p-6 text-center text-sm text-muted-foreground space-y-2">
          <BookOpen className="size-8 text-muted-foreground/50" />
          <h3 className="font-semibold text-foreground">No lessons found</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {search || statusFilter !== "all" || conceptFilter !== "all"
              ? "Try adjusting your search criteria or filter tags."
              : "Get started by generating your first interactive concept lesson."}
          </p>
          <Link href="/studio/new" className="pt-2">
            <Button size="sm" variant="outline" className="text-xs gap-1.5">
              <Plus className="size-3.5" />
              Create Lesson
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredLessons.map((lesson) => (
            <div
              key={lesson.id}
              className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-md"
            >
              {/* Card Body */}
              <div className="p-5 space-y-4">
                {/* Header Tag Row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary truncate">
                    {lesson.conceptName}
                  </span>

                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      lesson.status === "published"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
                    )}
                  >
                    {lesson.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>

                {/* Lesson Title & Module */}
                <div>
                  <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {lesson.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {lesson.moduleName}
                  </p>
                </div>

                {/* Pedagogy Metadata Chips */}
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 text-center text-xs">
                  <div>
                    <span className="block font-mono font-bold text-foreground">
                      {lesson.scenesCount ?? 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Scenes
                    </span>
                  </div>
                  <div className="border-x border-border/50">
                    <span className="block font-mono font-bold text-foreground">
                      {lesson.durationMinutes ?? 15}m
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Read Time
                    </span>
                  </div>
                  <div>
                    <span className="block font-mono font-bold text-foreground truncate">
                      {lesson.codeLanguage || "TS"}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Language
                    </span>
                  </div>
                </div>

                {/* Bottom Timestamp & Learner level */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Level: <span className="font-medium text-foreground capitalize">{lesson.learnerLevel || "All"}</span></span>
                  <span className="font-mono">{lesson.updatedAt.split(" ")[0]}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="bg-muted/30 px-5 py-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Link href={`/studio/${lesson.id}`} className="w-full">
                  <Button size="sm" className="w-full gap-1.5 text-xs font-semibold">
                    <FileText className="size-3.5" />
                    Open Studio Editor &rarr;
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
