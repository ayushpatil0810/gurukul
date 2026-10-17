"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Compass,
  ExternalLink,
  GitBranch,
  Layers,
  Lock,
  Play,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Unlock,
  X,
  Zap,
} from "lucide-react";
import type {
  StudentCurriculumRoadmapView,
  StudentCourseModuleItem,
} from "@/lib/services/concepts";
import { formatMastery } from "@/lib/engine/dashboard-bands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

/* -------------------------------------------------------------------------- */
/*                            Custom Graph Node                               */
/* -------------------------------------------------------------------------- */

type ConceptNodeData = {
  module: StudentCourseModuleItem;
  isSelected: boolean;
  threshold: number;
  courseId: string;
  onSelect: (module: StudentCourseModuleItem) => void;
  onNavigateToLearn: (module: StudentCourseModuleItem) => void;
};

function ConceptCustomNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  const mod = data.module;
  const isSelected = data.isSelected;

  return (
    <div
      onClick={() => data.onNavigateToLearn(mod)}
      className={cn(
        "group relative rounded-xl border p-3.5 shadow-md transition-all cursor-pointer w-[250px] select-none text-left",
        isSelected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary"
          : "hover:scale-[1.02]",
        mod.status === "Mastered"
          ? "border-emerald-500/50 bg-card/95 hover:border-emerald-500 shadow-emerald-500/5"
          : mod.status === "In Progress"
            ? "border-blue-500/50 bg-card/95 hover:border-blue-500 shadow-blue-500/5"
            : mod.status === "Ready to Learn"
              ? "border-primary/40 bg-card/95 hover:border-primary shadow-primary/5"
              : "border-border/60 bg-muted/40 opacity-75 hover:opacity-100",
      )}
    >
      {/* Target Handle on the Left (for incoming prerequisites) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background -left-1.5"
      />

      {/* Header: Step Pill & Status Badge */}
      <div className="flex items-center justify-between gap-1 text-[11px] mb-1.5">
        <span className="font-mono font-bold text-muted-foreground flex items-center gap-1">
          {mod.isGoal ? (
            <Award className="size-3 text-amber-500 fill-amber-500" />
          ) : (
            <span className="text-[10px] text-muted-foreground/70">#</span>
          )}
          Step {mod.step}
        </span>

        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[9px] font-semibold border flex items-center gap-1",
            mod.status === "Mastered"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
              : mod.status === "In Progress"
                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                : mod.status === "Ready to Learn"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground border-border/80",
          )}
        >
          {mod.status === "Mastered" ? (
            <CheckCircle2 className="size-2.5" />
          ) : mod.status === "Ready to Learn" ? (
            <Unlock className="size-2.5" />
          ) : mod.status === "In Progress" ? (
            <Zap className="size-2.5" />
          ) : (
            <Lock className="size-2.5" />
          )}
          <span>{mod.status}</span>
        </span>
      </div>

      {/* Module Title */}
      <p className="font-bold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors">
        {mod.name}
      </p>

      {/* Brief Information */}
      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-snug">
        {mod.description}
      </p>

      {/* Mastery Progress Bar */}
      <div className="mt-2.5 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
          <span>Mastery</span>
          <span
            className={cn(
              "font-bold",
              mod.pKnow !== null && mod.pKnow >= data.threshold
                ? "text-emerald-600 dark:text-emerald-400"
                : mod.pKnow !== null
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground",
            )}
          >
            {mod.pKnow !== null ? `${Math.round(mod.pKnow * 100)}%` : "0%"}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              mod.status === "Mastered"
                ? "bg-emerald-500"
                : mod.status === "In Progress"
                  ? "bg-blue-500"
                  : "bg-muted-foreground/30",
            )}
            style={{ width: `${Math.round((mod.pKnow ?? 0) * 100)}%` }}
          />
        </div>

        {/* Footer Actions: Inspect & Learn Concept Redirect */}
        <div className="mt-2.5 flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onSelect(mod);
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground font-medium underline"
          >
            Inspect
          </button>
          <Link
            href={`/learn?moduleId=${data.courseId}&conceptId=${mod.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold shadow-xs hover:bg-primary/90 transition-colors"
          >
            <BookOpen className="size-2.5" />
            <span>Learn Module &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Source Handle on the Right (for outgoing unlocks) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background -right-1.5"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Main Student Concept Map                           */
/* -------------------------------------------------------------------------- */

export function StudentConceptMapView({
  view,
}: {
  view: StudentCurriculumRoadmapView;
}) {
  const router = useRouter();

  // Active course selection
  const [activeCourseId, setActiveCourseId] = useState<string>(
    view.activeCourse?.id ?? view.courses[0]?.id ?? "",
  );

  // Active view mode: graph | roadmap | modules
  const [viewMode, setViewMode] = useState<"roadmap" | "graph" | "modules">("roadmap");

  // Filter modules
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Mastered" | "In Progress" | "Ready to Learn" | "Prerequisites Blocked"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Module Inspector Drawer state
  const [inspectedModuleId, setInspectedModuleId] = useState<string | null>(
    view.activeCourse?.prerequisiteFlowSummary.nextRecommendedModule?.id ??
      view.activeCourse?.modules[0]?.id ??
      null,
  );
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Trainer admin form state
  const [trainerEditOpen, setTrainerEditOpen] = useState(false);
  const [newConceptName, setNewConceptName] = useState("");
  const [newConceptDesc, setNewConceptDesc] = useState("");
  const [targetConceptId, setTargetConceptId] = useState(
    view.rawConceptMap.concepts[0]?.id ?? "",
  );
  const [requiresConceptId, setRequiresConceptId] = useState(
    view.rawConceptMap.concepts[1]?.id ?? view.rawConceptMap.concepts[0]?.id ?? "",
  );
  const [adminPending, setAdminPending] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Current active course data
  const currentCourse = useMemo(() => {
    return view.courses.find((c) => c.id === activeCourseId) ?? view.courses[0] ?? null;
  }, [view.courses, activeCourseId]);

  const activeCourseDetails = useMemo(() => {
    if (view.activeCourse && view.activeCourse.id === activeCourseId) {
      return view.activeCourse;
    }
    return view.activeCourse;
  }, [view.activeCourse, activeCourseId]);

  const modulesList = useMemo(() => {
    return activeCourseDetails?.modules ?? [];
  }, [activeCourseDetails]);

  // Filtered modules
  const filteredModules = useMemo(() => {
    return modulesList.filter((mod) => {
      const matchesStatus = statusFilter === "all" || mod.status === statusFilter;
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [modulesList, statusFilter, searchQuery]);

  // Selected module for detail inspection
  const inspectedModule = useMemo(() => {
    if (!inspectedModuleId) return modulesList[0] ?? null;
    return modulesList.find((m) => m.id === inspectedModuleId) ?? modulesList[0] ?? null;
  }, [modulesList, inspectedModuleId]);

  const handleSelectModule = useCallback((mod: StudentCourseModuleItem) => {
    setInspectedModuleId(mod.id);
    setIsInspectorOpen(true);
  }, []);

  // ReactFlow custom nodes
  const nodeTypes = useMemo(() => ({ conceptNode: ConceptCustomNode }), []);

  const rfNodes = useMemo<Node<ConceptNodeData>[]>(() => {
    if (!activeCourseDetails) return [];
    return activeCourseDetails.modules.map((mod) => ({
      id: mod.id,
      type: "conceptNode",
      position: { x: mod.x, y: mod.y },
      data: {
        module: mod,
        isSelected: mod.id === inspectedModuleId,
        threshold: activeCourseDetails.masteryThreshold,
        courseId: activeCourseId,
        onSelect: handleSelectModule,
        onNavigateToLearn: (selectedMod) => {
          router.push(`/learn?moduleId=${activeCourseId}&conceptId=${selectedMod.id}`);
        },
      },
    }));
  }, [activeCourseDetails, inspectedModuleId, handleSelectModule, activeCourseId, router]);

  // ReactFlow edges
  const rfEdges = useMemo<Edge[]>(() => {
    if (!activeCourseDetails) return [];
    return activeCourseDetails.flowEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.isMet,
      style: {
        stroke: edge.isMet ? "var(--emerald-500, #10b981)" : "var(--border, #64748b)",
        strokeWidth: edge.isMet ? 2 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.isMet ? "var(--emerald-500, #10b981)" : "var(--border, #64748b)",
        width: 16,
        height: 16,
      },
    }));
  }, [activeCourseDetails]);

  // Stages of course progression
  const courseStages = useMemo(() => {
    if (!activeCourseDetails) return [];
    const list = activeCourseDetails.modules;
    const foundational = list.filter((m) => m.prerequisites.length === 0);
    const intermediate = list.filter((m) => m.prerequisites.length === 1 && !m.isGoal);
    const advanced = list.filter((m) => m.prerequisites.length >= 2 && !m.isGoal);
    const capstone = list.filter((m) => m.isGoal);

    return [
      {
        stageNumber: 1,
        title: "Foundations & Primitives",
        subtitle: "Core building blocks with zero blocker dependencies",
        badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        modules: foundational,
      },
      {
        stageNumber: 2,
        title: "Core Engineering Mechanisms",
        subtitle: "Intermediate concepts building on foundational theory",
        badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
        modules: intermediate,
      },
      {
        stageNumber: 3,
        title: "Advanced Architecture & Systems",
        subtitle: "Complex multi-dependency patterns and system design",
        badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        modules: advanced,
      },
      {
        stageNumber: 4,
        title: "Capstone Goal Competency",
        subtitle: "The ultimate mastery objective of this course",
        badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        modules: capstone.length > 0 ? capstone : list.slice(-1),
      },
    ].filter((s) => s.modules.length > 0);
  }, [activeCourseDetails]);

  // Trainer admin actions
  async function handleCreateConcept(e: React.FormEvent) {
    e.preventDefault();
    setAdminPending(true);
    setAdminError(null);
    try {
      const res = await fetch("/api/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newConceptName, description: newConceptDesc }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAdminError(data.error?.message ?? "Failed to create concept");
      } else {
        setNewConceptName("");
        setNewConceptDesc("");
        router.refresh();
      }
    } catch {
      setAdminError("Network error creating concept");
    } finally {
      setAdminPending(false);
    }
  }

  async function handleAddPrerequisite(e: React.FormEvent) {
    e.preventDefault();
    setAdminPending(true);
    setAdminError(null);
    try {
      const res = await fetch(`/api/concepts/${targetConceptId}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresId: requiresConceptId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAdminError(data.error?.message ?? "Failed to add prerequisite edge");
      } else {
        router.refresh();
      }
    } catch {
      setAdminError("Network error connecting prerequisite");
    } finally {
      setAdminPending(false);
    }
  }

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Course Switcher */}
      <header className="space-y-4 border-b border-border/60 pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Compass className="size-3.5 animate-pulse" />
                Concept Map & Curriculum Roadmaps
              </span>
              <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Enrolled Courses: {view.courses.length}
              </span>
              {currentCourse?.batchName ? (
                <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Cohort: {currentCourse.batchName}
                </span>
              ) : null}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {currentCourse?.name ?? "Course Curriculum"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Explore your course modules, track progress toward capstone concepts, and examine prerequisite dependencies that determine how topics flow into one another.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
              <Link href={activeCourseId ? `/practice?moduleId=${activeCourseId}` : "/practice"}>
                <Play className="size-3.5" />
                <span>Practice Lab</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
              <Link href="/assessment">
                <Award className="size-3.5" />
                <span>Online Assessment</span>
              </Link>
            </Button>
            {view.canEdit ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTrainerEditOpen(!trainerEditOpen)}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <GitBranch className="size-3.5" />
                <span>{trainerEditOpen ? "Hide DAG Editor" : "Manage DAG"}</span>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Enrolled Courses Selection Tabs (If student has multiple courses) */}
        {view.courses.length > 1 ? (
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Select Enrolled Course Track
            </p>
            <div className="flex flex-wrap gap-2.5">
              {view.courses.map((course) => {
                const isActive = course.id === activeCourseId;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      setActiveCourseId(course.id);
                      router.push(`/curriculum?moduleId=${course.id}`);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-2.5 px-3.5 text-left text-xs transition-all",
                      isActive
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border/80 bg-card hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <BookOpen className="size-3.5" />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{course.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{course.totalModulesCount} Modules</span>
                        <span>&bull;</span>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {Math.round(course.completionRate * 100)}% Mastered
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      {/* 2. Brief Information about the Course (Course Overview Hero Card) */}
      {activeCourseDetails ? (
        <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/90 to-primary/5 p-6 shadow-xs space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Left: Course Brief Information */}
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-bold border border-primary/20">
                  <Sparkles className="size-3" />
                  Target Goal: {activeCourseDetails.goalConceptName}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Mastery Threshold: {(activeCourseDetails.masteryThreshold * 100).toFixed(0)}%
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {activeCourseDetails.name}
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {activeCourseDetails.description}
              </p>

              {/* Prerequisite Flow Summary Badge */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="rounded bg-muted/60 px-2 py-0.5 font-medium">
                  {activeCourseDetails.prerequisiteFlowSummary.foundationalCount} Foundational Modules
                </span>
                <span>&rarr;</span>
                <span className="rounded bg-muted/60 px-2 py-0.5 font-medium">
                  {activeCourseDetails.prerequisiteFlowSummary.intermediateCount} Intermediate
                </span>
                <span>&rarr;</span>
                <span className="rounded bg-muted/60 px-2 py-0.5 font-medium">
                  {activeCourseDetails.prerequisiteFlowSummary.advancedCount} Advanced / Capstone
                </span>
              </div>
            </div>

            {/* Right: Progress Tracking Cards */}
            <div className="grid grid-cols-2 gap-3 shrink-0 sm:grid-cols-4 lg:grid-cols-2 lg:w-80">
              <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Course Completion</span>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {Math.round(activeCourseDetails.completionRate * 100)}%
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted mt-2">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.round(activeCourseDetails.completionRate * 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Modules Mastered</span>
                <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {activeCourseDetails.masteredCount} / {activeCourseDetails.totalModulesCount}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(activeCourseDetails.totalModulesCount - activeCourseDetails.masteredCount)} remaining
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Overall Status</span>
                <p className="text-sm font-bold text-foreground">
                  {activeCourseDetails.overallStatus}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Calibration threshold ≥ {(activeCourseDetails.masteryThreshold * 100).toFixed(0)}%
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Next Focus Step</span>
                <p className="text-sm font-bold text-primary truncate">
                  {activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule?.name ?? "Course Complete"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule
                    ? `Step ${activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule.step} ready`
                    : "All steps solid"}
                </p>
              </div>
            </div>
          </div>

          {/* Active Next Step Recommendation Banner */}
          {activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule ? (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                  🚀
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                      Recommended Next Step
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      Step {activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule.step}: {activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() =>
                    handleSelectModule(activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule!)
                  }
                  variant="outline"
                  className="h-8 text-xs font-medium"
                >
                  Inspect Module
                </Button>
                <Button asChild size="sm" className="h-8 text-xs font-semibold shadow-xs">
                  <Link
                    href={`/learn?moduleId=${activeCourseDetails.id}&conceptId=${activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule.id}`}
                  >
                    <BookOpen className="size-3.5" />
                    <span>Start Learning Module</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs font-medium">
                  <Link
                    href={`/practice?moduleId=${activeCourseDetails.id}&conceptId=${activeCourseDetails.prerequisiteFlowSummary.nextRecommendedModule.id}`}
                  >
                    <Play className="size-3" />
                    <span>Practice</span>
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 3. View Mode Switcher & Controls */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/80 bg-muted/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("roadmap")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors",
                viewMode === "roadmap"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GitBranch className="size-3.5" />
              <span>Flow Roadmap</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors",
                viewMode === "graph"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Compass className="size-3.5" />
              <span>Interactive DAG Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("modules")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors",
                viewMode === "modules"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Layers className="size-3.5" />
              <span>All {modulesList.length} Modules</span>
            </button>
          </div>
        </div>

        {/* Quick Filter & Search */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search modules…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="all">All Statuses ({modulesList.length})</option>
            <option value="Mastered">Mastered ({modulesList.filter((m) => m.status === "Mastered").length})</option>
            <option value="In Progress">In Progress ({modulesList.filter((m) => m.status === "In Progress").length})</option>
            <option value="Ready to Learn">Ready to Learn ({modulesList.filter((m) => m.status === "Ready to Learn").length})</option>
            <option value="Prerequisites Blocked">Blocked ({modulesList.filter((m) => m.status === "Prerequisites Blocked").length})</option>
          </select>
        </div>
      </section>

      {/* 4. VIEW 1: Sequential Flow Roadmap (How the course goes one after the other) */}
      {viewMode === "roadmap" && (
        <section className="space-y-6">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-2">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              <span>Step-by-Step Course Flow Roadmap</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              This roadmap illustrates how the course moves one topic after the other. Each stage completes foundational requirements before unlocking downstream competencies.
            </p>
          </div>

          <div className="space-y-8">
            {courseStages.map((stage) => (
              <div key={stage.stageNumber} className="space-y-4">
                {/* Stage Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold border", stage.badgeColor)}>
                      Stage {stage.stageNumber}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">{stage.title}</h4>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {stage.subtitle} &bull; {stage.modules.length} {stage.modules.length === 1 ? "Module" : "Modules"}
                  </span>
                </div>

                {/* Modules in this stage */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stage.modules.map((mod) => (
                    <div
                      key={mod.id}
                      onClick={() => router.push(`/learn?moduleId=${activeCourseId}&conceptId=${mod.id}`)}
                      className={cn(
                        "group relative rounded-xl border p-4.5 shadow-xs transition-all cursor-pointer flex flex-col justify-between",
                        inspectedModuleId === mod.id
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary"
                          : "hover:border-primary/50 hover:shadow-md",
                        mod.status === "Mastered"
                          ? "bg-emerald-500/5 border-emerald-500/30"
                          : mod.status === "In Progress"
                            ? "bg-blue-500/5 border-blue-500/30"
                            : mod.status === "Ready to Learn"
                              ? "bg-card border-border/80"
                              : "bg-muted/30 border-border/50 opacity-80",
                      )}
                    >
                      <div className="space-y-2">
                        {/* Header: Step & Status */}
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="font-mono font-bold text-muted-foreground">
                            Step {mod.step} of {activeCourseDetails?.totalModulesCount}
                          </span>
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-semibold border flex items-center gap-1",
                              mod.status === "Mastered"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                : mod.status === "In Progress"
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                  : mod.status === "Ready to Learn"
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            {mod.status === "Mastered" ? (
                              <CheckCircle2 className="size-3" />
                            ) : mod.status === "Ready to Learn" ? (
                              <Unlock className="size-3" />
                            ) : (
                              <Lock className="size-3" />
                            )}
                            <span>{mod.status}</span>
                          </span>
                        </div>

                        {/* Title & Brief Information */}
                        <div>
                          <h5 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {mod.name}
                            {mod.isGoal ? (
                              <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                                Capstone Goal
                              </span>
                            ) : null}
                          </h5>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                            {mod.description}
                          </p>
                        </div>

                        {/* Prerequisite & Unlock Context (Flow representation) */}
                        <div className="pt-2 border-t border-border/50 text-[11px] space-y-1 text-muted-foreground">
                          <p className="flex items-center gap-1 truncate">
                            <span className="font-semibold text-foreground/80">Requires:</span>
                            {mod.prerequisites.length === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">None (Foundational)</span>
                            ) : (
                              <span>{mod.prerequisites.map((p) => p.name).join(", ")}</span>
                            )}
                          </p>
                          {mod.unlocks.length > 0 ? (
                            <p className="flex items-center gap-1 text-primary truncate font-medium">
                              <span>Unlocks:</span>
                              <span>{mod.unlocks.map((u) => u.name).join(", ")}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Mastery Progress Meter & Actions */}
                      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-muted-foreground text-[11px]">Score:</span>
                          <span
                            className={cn(
                              "font-bold",
                              mod.status === "Mastered"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : mod.status === "In Progress"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-foreground",
                            )}
                          >
                            {mod.pKnow !== null ? `${Math.round(mod.pKnow * 100)}%` : "0%"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button asChild size="sm" className="h-7 text-[11px] font-semibold gap-1 shadow-xs">
                            <Link
                              href={`/learn?moduleId=${activeCourseId}&conceptId=${mod.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <BookOpen className="size-2.5" />
                              <span>Learn</span>
                              <ArrowRight className="size-2.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] font-medium px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectModule(mod);
                            }}
                          >
                            <span>Inspect</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. VIEW 2: Interactive Visual DAG Concept Map (ReactFlow Canvas) */}
      {viewMode === "graph" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Compass className="size-4 text-primary" />
                <span>Interactive DAG Graph Visualization</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Prerequisites flow from left to right toward the capstone goal. Drag canvas to pan; click any node to inspect detailed briefings.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span>Mastered</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-blue-500" />
                <span>In Progress</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" />
                <span>Ready to Learn</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-muted-foreground/40" />
                <span>Blocked</span>
              </span>
            </div>
          </div>

          <div className="h-[600px] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xs relative">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background gap={18} size={1} />
              <Controls position="top-right" />
              <MiniMap
                position="bottom-right"
                nodeStrokeWidth={3}
                nodeColor={(node) => {
                  const mod = (node.data as ConceptNodeData)?.module;
                  if (!mod) return "#94a3b8";
                  if (mod.status === "Mastered") return "#10b981";
                  if (mod.status === "In Progress") return "#3b82f6";
                  if (mod.status === "Ready to Learn") return "#6366f1";
                  return "#94a3b8";
                }}
                className="!bg-background/90 !border !border-border !rounded-lg"
              />
            </ReactFlow>
          </div>
        </section>
      )}

      {/* 6. VIEW 3: Module Syllabus & Briefings Directory (10 Modules Grid) */}
      {viewMode === "modules" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Module Syllabus & Brief Information Directory
            </h3>
            <p className="text-xs text-muted-foreground">
              Showing {filteredModules.length} of {modulesList.length} course modules in topological learning order.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredModules.map((mod) => (
              <div
                key={mod.id}
                onClick={() => router.push(`/learn?moduleId=${activeCourseId}&conceptId=${mod.id}`)}
                className={cn(
                  "group relative rounded-xl border p-4.5 shadow-xs transition-all cursor-pointer flex flex-col justify-between",
                  inspectedModuleId === mod.id
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary"
                    : "hover:border-primary/50 hover:shadow-md",
                  mod.status === "Mastered"
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : mod.status === "In Progress"
                      ? "bg-blue-500/5 border-blue-500/30"
                      : "bg-card border-border/80",
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-mono font-bold text-muted-foreground">
                      Module {mod.step < 10 ? `0${mod.step}` : mod.step}
                    </span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-semibold border",
                        mod.status === "Mastered"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : mod.status === "In Progress"
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            : "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {mod.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      {mod.name}
                      {mod.isGoal ? (
                        <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                          Goal
                        </span>
                      ) : null}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-3 mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>

                  {/* Prerequisites */}
                  <div className="pt-2 border-t border-border/50 text-[11px] space-y-1">
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground/80">Prerequisites: </span>
                      {mod.prerequisites.length === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">None (Foundational)</span>
                      ) : (
                        <span>{mod.prerequisites.map((p) => p.name).join(", ")}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                  <div className="font-mono">
                    <span className="text-[11px] text-muted-foreground">Mastery: </span>
                    <span className="font-bold text-foreground">
                      {mod.pKnow !== null ? `${Math.round(mod.pKnow * 100)}%` : "0%"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button asChild size="sm" className="h-7 text-xs font-semibold gap-1 shadow-xs">
                      <Link
                        href={`/learn?moduleId=${activeCourseId}&conceptId=${mod.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <BookOpen className="size-3" />
                        <span>Learn</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs font-medium gap-1">
                      <Link
                        href={`/practice?moduleId=${activeCourseId}&conceptId=${mod.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Practice</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Interactive Module Inspector Drawer / Detail Card */}
      {inspectedModule && isInspectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsInspectorOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>

            {/* Header */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-mono font-bold">
                  Step {inspectedModule.step} of {activeCourseDetails?.totalModulesCount}
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold border",
                    inspectedModule.status === "Mastered"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                      : inspectedModule.status === "In Progress"
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                        : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {inspectedModule.status}
                </span>
                {inspectedModule.isGoal ? (
                  <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 text-xs font-bold">
                    Capstone Goal Concept
                  </span>
                ) : null}
              </div>

              <h3 className="text-xl font-bold tracking-tight text-foreground">
                {inspectedModule.name}
              </h3>
            </div>

            {/* Brief Information & Description */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Module Information & Syllabus Briefing
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {inspectedModule.description}
              </p>
            </div>

            {/* Progress Tracking Matrix */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3 space-y-1 bg-background/50">
                <span className="text-[11px] font-medium text-muted-foreground">Mastery Score</span>
                <p className="text-lg font-bold font-mono text-foreground">
                  {inspectedModule.pKnow !== null ? formatMastery(inspectedModule.pKnow) : "0% (Unrecorded)"}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1 bg-background/50">
                <span className="text-[11px] font-medium text-muted-foreground">Mastery Band</span>
                <p className="text-sm font-semibold capitalize text-foreground">
                  {inspectedModule.band === "solid"
                    ? "Solid (Mastered)"
                    : inspectedModule.band === "below_threshold"
                      ? "Developing"
                      : "Not Recorded"}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1 bg-background/50">
                <span className="text-[11px] font-medium text-muted-foreground">Confidence Metric</span>
                <p className="text-sm font-semibold text-foreground font-mono">
                  {(inspectedModule.confidence * 100).toFixed(0)}% calibration
                </p>
              </div>
            </div>

            {/* Prerequisite Flow Diagnostics */}
            <div className="space-y-3 pt-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Prerequisites Required (Incoming Flow)
                </p>
                {inspectedModule.prerequisites.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Foundational module &bull; Zero prior dependencies required.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {inspectedModule.prerequisites.map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium flex items-center gap-1.5",
                          p.state === "met"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
                        )}
                      >
                        {p.state === "met" ? <CheckCircle2 className="size-3" /> : <Lock className="size-3" />}
                        <span>{p.name}: {p.state === "met" ? "Met" : "Below Threshold"}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {inspectedModule.unlocks.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Subsequent Modules Unlocked (Outgoing Flow)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inspectedModule.unlocks.map((u) => (
                      <span
                        key={u.id}
                        className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary flex items-center gap-1.5"
                      >
                        <Unlock className="size-3" />
                        <span>{u.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInspectorOpen(false)}
                className="text-xs"
              >
                Close Inspector
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="gap-1.5 text-xs font-semibold shadow-xs">
                  <Link
                    href={`/learn?moduleId=${activeCourseId}&conceptId=${inspectedModule.id}`}
                  >
                    <BookOpen className="size-3.5" />
                    <span>Study in Learning Module</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
                  <Link
                    href={`/practice?moduleId=${activeCourseId}&conceptId=${inspectedModule.id}`}
                  >
                    <Play className="size-3.5" />
                    <span>Practice Lab</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Trainer & Admin DAG Management Collapsible */}
      {view.canEdit && trainerEditOpen && (
        <section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 animate-in slide-in-from-top-4 duration-200">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Curriculum DAG Authoring Tools</h3>
              <p className="text-xs text-muted-foreground">
                Add new concepts or configure prerequisite dependency edges. Cycles are strictly detected and blocked by Kahn&apos;s algorithm.
              </p>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
              Trainer Mode
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Form 1: Add Concept */}
            <form onSubmit={handleCreateConcept} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Add New Curriculum Concept
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="admin-concept-name" className="text-xs">Concept Name</Label>
                <Input
                  id="admin-concept-name"
                  value={newConceptName}
                  onChange={(e) => setNewConceptName(e.target.value)}
                  placeholder="e.g. Distributed Consensus"
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-concept-desc" className="text-xs">Brief Description</Label>
                <Input
                  id="admin-concept-desc"
                  value={newConceptDesc}
                  onChange={(e) => setNewConceptDesc(e.target.value)}
                  placeholder="Summary of skills and benchmarks"
                  className="h-8 text-xs"
                />
              </div>
              <Button type="submit" size="sm" disabled={adminPending} className="w-full text-xs font-semibold">
                Create Concept
              </Button>
            </form>

            {/* Form 2: Add Prerequisite Edge */}
            <form onSubmit={handleAddPrerequisite} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Add Prerequisite Dependency Edge
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="admin-target-concept" className="text-xs">Target Concept (Dependent)</Label>
                <select
                  id="admin-target-concept"
                  value={targetConceptId}
                  onChange={(e) => setTargetConceptId(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground"
                >
                  {view.rawConceptMap.concepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-requires-concept" className="text-xs">Requires (Prerequisite)</Label>
                <select
                  id="admin-requires-concept"
                  value={requiresConceptId}
                  onChange={(e) => setRequiresConceptId(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground"
                >
                  {view.rawConceptMap.concepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={adminPending || view.rawConceptMap.concepts.length < 2}
                className="w-full text-xs font-semibold"
              >
                Connect Prerequisite
              </Button>
            </form>
          </div>

          {adminError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              {adminError}
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
