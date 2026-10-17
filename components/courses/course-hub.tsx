"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderKanban,
  GraduationCap,
  Layers,
  Network,
  Plus,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { CourseSummaryItem, CourseDetailView } from "@/lib/services/courses";
import { CreateCourseDialog } from "./create-course-dialog";
import { CourseDesigner } from "./course-designer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

export function CourseHub({
  initialCourses,
  batches,
  availableModules,
}: {
  initialCourses: CourseSummaryItem[];
  batches: { id: string; name: string }[];
  availableModules: { id: string; name: string }[];
}) {
  const [courses, setCourses] = useState<CourseSummaryItem[]>(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<CourseDetailView | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [designerTab, setDesignerTab] = useState<"hierarchy" | "dag" | "batches" | "settings">("hierarchy");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");

  // Load detailed view for selected course
  async function handleOpenDesigner(
    courseId: string,
    initialTab: "hierarchy" | "dag" | "batches" | "settings" = "hierarchy",
  ) {
    setSelectedCourseId(courseId);
    setDesignerTab(initialTab);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSelectedCourseDetail(data.data);
      }
    } catch {
      // Handle error
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleRefreshHub() {
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (data.success && data.data) {
        setCourses(data.data);
      }
    } catch {
      // Ignore background refresh error
    }
  }

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch =
        search === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchBatch =
        batchFilter === "all" || c.batches.some((b) => b.id === batchFilter);

      return matchSearch && matchStatus && matchBatch;
    });
  }, [courses, search, statusFilter, batchFilter]);

  // Aggregate Metrics
  const publishedCount = courses.filter((c) => c.status === "published").length;
  const draftCount = courses.filter((c) => c.status === "draft").length;
  const totalConcepts = courses.reduce((acc, c) => acc + c.conceptsCount, 0);
  const totalStudents = courses.reduce((acc, c) => acc + c.enrolledStudentsCount, 0);

  // If a course is actively open in the designer, render CourseDesigner
  if (selectedCourseId) {
    if (loadingDetail || !selectedCourseDetail) {
      return (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border/70 bg-card p-12 text-sm text-muted-foreground animate-pulse">
          Loading course designer & knowledge graph...
        </div>
      );
    }

    return (
      <CourseDesigner
        initialDetail={selectedCourseDetail}
        initialTab={designerTab}
        onBack={() => {
          setSelectedCourseId(null);
          setSelectedCourseDetail(null);
          handleRefreshHub();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
            <span className="size-1.5 rounded-full bg-primary" />
            Curriculum Architecture & Operations
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Course Management
          </h1>
          <p className="mt-1 max-w-[65ch] text-pretty text-sm text-muted-foreground">
            Author modular learning tracks, configure section concepts, inspect prerequisite graphs, and assign cohort batches.
          </p>
        </div>

        <CreateCourseDialog
          batches={batches}
          availableModules={availableModules}
          onCreated={(newId) => {
            handleRefreshHub();
            handleOpenDesigner(newId);
          }}
        />
      </div>

      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Courses</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {courses.length}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {publishedCount} published · {draftCount} draft
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Curriculum Concepts</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Network className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {totalConcepts}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Structured into directed prerequisite DAGs
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Cohort Batches</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {batches.length}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Assigned to course curricula
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Enrolled Students</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {totalStudents}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Across active batch tracks
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search courses by title, code, or description..."
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          {batches.length > 0 ? (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="all">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <span className="text-xs text-muted-foreground font-mono">
          Showing {filteredCourses.length} of {courses.length} courses
        </span>
      </div>

      {/* Courses List Flow */}
      {filteredCourses.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card p-6 text-center">
          <BookOpen className="size-8 text-muted-foreground/60 mb-2" />
          <h3 className="text-sm font-semibold text-foreground">No courses match your filter</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Try adjusting your search query, or create a new course track to begin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="rounded-xl border border-border/70 bg-card shadow-xs hover:border-border transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-border/70 bg-muted px-2 py-0.5 text-xs font-mono font-bold text-foreground">
                    {course.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      {course.level}
                    </span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
                        course.status === "published"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                      )}
                    >
                      {course.status}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground line-clamp-1">{course.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {course.description || "No description provided."}
                  </p>
                </div>

                {/* Hierarchy metric chips */}
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center text-xs">
                  <div>
                    <span className="block font-mono font-bold text-foreground">
                      {course.modulesCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Modules
                    </span>
                  </div>
                  <div className="border-x border-border/50">
                    <span className="block font-mono font-bold text-foreground">
                      {course.sectionsCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Sections
                    </span>
                  </div>
                  <div>
                    <span className="block font-mono font-bold text-foreground">
                      {course.conceptsCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Concepts
                    </span>
                  </div>
                </div>

                {/* Batches & Goal Concept */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Assigned Batches:</span>
                    <span className="font-medium text-foreground">
                      {course.batches.length > 0
                        ? course.batches.map((b) => b.name).join(", ")
                        : "None (Unassigned)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Mastery Threshold:</span>
                    <span className="font-mono font-semibold text-primary">
                      {(course.masteryThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="bg-muted/30 px-4 py-3 border-t border-border/60 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs font-semibold hover:border-primary hover:text-primary transition-colors"
                  onClick={() => handleOpenDesigner(course.id, "dag")}
                >
                  <Network className="size-3.5 text-primary" />
                  Knowledge Graph
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                  onClick={() => handleOpenDesigner(course.id, "hierarchy")}
                >
                  <Layers className="size-3.5" />
                  Curriculum Tree
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
