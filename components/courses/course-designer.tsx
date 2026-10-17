"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  GraduationCap,
  Layers,
  Network,
  Plus,
  Save,
  Send,
  Settings,
  Sliders,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { CourseDetailView } from "@/lib/services/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourseDagGraph } from "./course-dag-graph";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "cn";

export function CourseDesigner({
  initialDetail,
  initialTab = "hierarchy",
  onBack,
}: {
  initialDetail: CourseDetailView;
  initialTab?: "hierarchy" | "dag" | "batches" | "settings";
  onBack?: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<CourseDetailView>(initialDetail);
  const [activeTab, setActiveTab] = useState<"hierarchy" | "dag" | "batches" | "settings">(initialTab);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states for creating modules, sections, and concepts
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [newModuleThreshold, setNewModuleThreshold] = useState(0.8);

  const [activeModuleForSection, setActiveModuleForSection] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");

  const [activeSectionForConcept, setActiveSectionForConcept] = useState<string | null>(null);
  const [selectedConceptToAttach, setSelectedConceptToAttach] = useState<string>("");

  // Settings tab form state
  const [editName, setEditName] = useState(detail.course.name);
  const [editCode, setEditCode] = useState(detail.course.code);
  const [editDesc, setEditDesc] = useState(detail.course.description);
  const [editLevel, setEditLevel] = useState(detail.course.level);
  const [editThreshold, setEditThreshold] = useState(detail.course.masteryThreshold);
  const [editGoalId, setEditGoalId] = useState(detail.course.goalConceptId ?? "");

  // Batches tab form state
  const [selectedBatches, setSelectedBatches] = useState<string[]>(
    detail.assignedBatches.map((b) => b.id),
  );
  const [cohortDeadline, setCohortDeadline] = useState<string>(
    detail.assignedBatches[0]?.deadline ? detail.assignedBatches[0].deadline.slice(0, 10) : "",
  );

  async function refreshCourse() {
    try {
      const res = await fetch(`/api/courses/${detail.course.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setDetail(data.data);
      }
    } catch {
      // Ignore background refresh failure
    }
  }

  // --- ACTIONS ---

  async function handlePublish() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${detail.course.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Publish failed");
      setSuccess("Course published successfully!");
      await refreshCourse();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPending(false);
    }
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModuleName) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${detail.course.id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newModuleName,
          masteryThreshold: newModuleThreshold,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to add module");
      setIsAddModuleOpen(false);
      setNewModuleName("");
      await refreshCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add module");
    } finally {
      setPending(false);
    }
  }

  async function handleRemoveModule(moduleId: string) {
    if (!confirm("Are you sure you want to remove this module from the course?")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/courses/${detail.course.id}/modules?moduleId=${moduleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to remove module");
      await refreshCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove module");
    } finally {
      setPending(false);
    }
  }

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!activeModuleForSection || !newSectionTitle) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/modules/${activeModuleForSection}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSectionTitle,
          description: newSectionDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to add section");
      setActiveModuleForSection(null);
      setNewSectionTitle("");
      setNewSectionDesc("");
      await refreshCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add section");
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm("Are you sure you want to delete this section?")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/sections/${sectionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to delete section");
      await refreshCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete section");
    } finally {
      setPending(false);
    }
  }

  async function handleAttachConcept(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSectionForConcept || !selectedConceptToAttach) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/sections/${activeSectionForConcept}/concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId: selectedConceptToAttach }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to attach concept");
      setActiveSectionForConcept(null);
      setSelectedConceptToAttach("");
      await refreshCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach concept");
    } finally {
      setPending(false);
    }
  }

  async function handleRemoveConceptFromSection(sectionId: string, conceptId: string) {
    setPending(true);
    try {
      const res = await fetch(`/api/sections/${sectionId}/concepts?conceptId=${conceptId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to remove concept");
      await refreshCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove concept");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${detail.course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          description: editDesc,
          level: editLevel,
          masteryThreshold: editThreshold,
          goalConceptId: editGoalId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to save settings");
      setSuccess("Course settings saved successfully.");
      await refreshCourse();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveBatches(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${detail.course.id}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchIds: selectedBatches,
          deadline: cohortDeadline ? new Date(cohortDeadline).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Failed to update batches");
      setSuccess("Batch assignments updated.");
      await refreshCourse();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update batches");
    } finally {
      setPending(false);
    }
  }

  // DAG edge creation bridge
  async function handleAddPrereqEdge(conceptId: string, requiresId: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/concepts/${conceptId}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return data.error?.message ?? "Failed to connect prerequisite";
      await refreshCourse();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to connect prerequisite";
    }
  }

  // Quick concept creation bridge
  async function handleCreateConceptDirect(name: string, description: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return data.error?.message ?? "Failed to create concept";
      await refreshCourse();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to create concept";
    }
  }

  // Aggregate stats
  const totalSections = detail.modules.reduce((acc, m) => acc + m.sections.length, 0);
  const totalConcepts = detail.modules.reduce(
    (acc, m) => acc + m.sections.reduce((sAcc, s) => sAcc + s.concepts.length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Back to Courses Hub
            </button>
            <span className="text-muted-foreground/40">•</span>
            <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-xs font-mono font-bold text-foreground">
              {detail.course.code}
            </span>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium border uppercase tracking-wider",
                detail.course.status === "published"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
              )}
            >
              {detail.course.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {detail.course.name}
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl">
            {detail.course.description || "No description provided."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {detail.course.status !== "published" ? (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={pending || !detail.validation.canPublish}
              title={
                !detail.validation.canPublish
                  ? `Cannot publish: ${detail.validation.issues.join(", ")}`
                  : undefined
              }
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              Publish Course
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> Published & Live
            </span>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      {/* Pre-publication Warning Banner */}
      {!detail.validation.canPublish && detail.course.status !== "published" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1.5 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-4" />
            <span>Pre-flight Publication Checklist ({detail.validation.issues.length} pending items)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
            {detail.validation.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 4 Tabs */}
      <div className="flex items-center gap-1 border-b border-border/70 pb-px text-xs font-medium">
        <button
          onClick={() => setActiveTab("hierarchy")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 transition-all cursor-pointer",
            activeTab === "hierarchy"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="size-4" />
          <span>Curriculum Hierarchy</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
            {detail.modules.length}M · {totalSections}S · {totalConcepts}C
          </span>
        </button>

        <button
          onClick={() => setActiveTab("dag")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 transition-all cursor-pointer",
            activeTab === "dag"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Network className="size-4" />
          <span>Prerequisite DAG</span>
        </button>

        <button
          onClick={() => setActiveTab("batches")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 transition-all cursor-pointer",
            activeTab === "batches"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="size-4" />
          <span>Cohort Batches</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
            {detail.assignedBatches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 transition-all cursor-pointer",
            activeTab === "settings"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings className="size-4" />
          <span>Course Policies & Settings</span>
        </button>
      </div>

      {/* TAB 1: CURRICULUM HIERARCHY TREE */}
      {activeTab === "hierarchy" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Course Modules & Sections</h2>
              <p className="text-xs text-muted-foreground">
                Structure the syllabus into modules, pedagogical sections, and target concepts.
              </p>
            </div>
            <Button size="sm" onClick={() => setIsAddModuleOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Add Module
            </Button>
          </div>

          {detail.modules.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card p-6 text-center">
              <FolderKanban className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold text-foreground">No modules created in this course yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Add your first learning module to begin organizing sections and knowledge concepts.
              </p>
              <Button size="sm" onClick={() => setIsAddModuleOpen(true)} className="mt-4 gap-1.5">
                <Plus className="size-4" />
                Add Module
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {detail.modules.map((mod, modIdx) => (
                <div
                  key={mod.id}
                  className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden"
                >
                  {/* Module Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-5 py-3.5 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono">
                        M{modIdx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-foreground">{mod.name}</h3>
                      <span className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                        Threshold: {(mod.masteryThreshold * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => setActiveModuleForSection(mod.id)}
                      >
                        <Plus className="size-3.5" />
                        Add Section
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 size-7 p-0 text-muted-foreground hover:text-destructive"
                        title="Remove Module"
                        onClick={() => handleRemoveModule(mod.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Sections List */}
                  <div className="p-5 space-y-4">
                    {mod.sections.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No sections inside this module yet. Click "+ Add Section" above.
                      </p>
                    ) : (
                      mod.sections.map((sec, secIdx) => (
                        <div
                          key={sec.id}
                          className="rounded-lg border border-border/60 bg-background/70 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-primary">
                                  § {secIdx + 1}
                                </span>
                                <h4 className="text-sm font-semibold text-foreground">{sec.title}</h4>
                              </div>
                              {sec.description ? (
                                <p className="text-xs text-muted-foreground">{sec.description}</p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => setActiveSectionForConcept(sec.id)}
                              >
                                <Plus className="size-3" />
                                Add Concept
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 size-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Delete Section"
                                onClick={() => handleDeleteSection(sec.id)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Concepts mapped */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                            {sec.concepts.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic">
                                No concepts attached. Click "+ Add Concept".
                              </span>
                            ) : (
                              sec.concepts.map((c) => (
                                <span
                                  key={c.id}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-foreground font-medium"
                                >
                                  <span>{c.name}</span>
                                  <button
                                    onClick={() => handleRemoveConceptFromSection(sec.id, c.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                    title="Remove from section"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* TAB 2: PREREQUISITE DAG VISUALIZER */}
      {activeTab === "dag" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Prerequisite Knowledge Graph</h2>
            <p className="text-xs text-muted-foreground">
              Connected concept dependencies form the adaptive learning loop. Adding an edge validates for cycle prevention.
            </p>
          </div>
          <CourseDagGraph
            courseConcepts={detail.courseConcepts}
            coursePrerequisites={detail.coursePrerequisites}
            allConcepts={detail.availableConcepts}
            allPrerequisites={detail.prerequisites}
            goalConceptId={detail.course.goalConceptId}
            courseName={detail.course.name}
            onAddPrerequisite={handleAddPrereqEdge}
            onCreateConcept={handleCreateConceptDirect}
          />
        </div>
      ) : null}

      {/* TAB 3: COHORT BATCHES */}
      {activeTab === "batches" ? (
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-6 max-w-2xl">
          <div>
            <h2 className="text-base font-semibold text-foreground">Cohort Batch Assignments</h2>
            <p className="text-xs text-muted-foreground">
              Assign this course to specific student batches and configure completion milestones.
            </p>
          </div>

          <form onSubmit={handleSaveBatches} className="space-y-4 text-xs">
            <div className="space-y-2">
              <Label className="font-semibold text-foreground">Select Cohort Batches</Label>
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 max-h-48 overflow-y-auto">
                {detail.availableBatches.length === 0 ? (
                  <p className="text-muted-foreground italic">No batches created in your institute yet.</p>
                ) : (
                  detail.availableBatches.map((batch) => (
                    <label
                      key={batch.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted/40 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedBatches.includes(batch.id)}
                          onChange={() => {
                            setSelectedBatches((prev) =>
                              prev.includes(batch.id)
                                ? prev.filter((id) => id !== batch.id)
                                : [...prev, batch.id],
                            );
                          }}
                          className="rounded accent-primary"
                        />
                        <span className="font-medium text-foreground">{batch.name}</span>
                      </div>
                      {batch.assigned ? (
                        <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                          Currently Active
                        </span>
                      ) : null}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-deadline" className="font-semibold text-foreground">
                Target Completion Deadline (Optional)
              </Label>
              <Input
                id="batch-deadline"
                type="date"
                value={cohortDeadline}
                onChange={(e) => setCohortDeadline(e.target.value)}
                className="w-full max-w-xs text-xs"
              />
            </div>

            <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
              <Save className="size-3.5" />
              Save Batch Assignments
            </Button>
          </form>
        </div>
      ) : null}

      {/* TAB 4: SETTINGS & POLICIES */}
      {activeTab === "settings" ? (
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-6 max-w-2xl">
          <div>
            <h2 className="text-base font-semibold text-foreground">Course Metadata & Calibration</h2>
            <p className="text-xs text-muted-foreground">
              Configure course details, mastery threshold, and designate the capstone goal concept.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="set-name" className="font-semibold">Course Title</Label>
              <Input
                id="set-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="set-code" className="font-semibold">Course Code</Label>
                <Input
                  id="set-code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-level" className="font-semibold">Difficulty Level</Label>
                <select
                  id="set-level"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  value={editLevel}
                  onChange={(e) => setEditLevel(e.target.value as any)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="set-desc" className="font-semibold">Description</Label>
              <textarea
                id="set-desc"
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="set-threshold" className="font-semibold">Global Mastery Threshold</Label>
                <span className="font-mono text-xs font-bold text-primary">
                  {(editThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="set-threshold"
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={editThreshold}
                onChange={(e) => setEditThreshold(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="set-goal" className="font-semibold">Capstone Goal Concept</Label>
              <select
                id="set-goal"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                value={editGoalId}
                onChange={(e) => setEditGoalId(e.target.value)}
              >
                <option value="">-- No Capstone Goal Selected --</option>
                {detail.availableConcepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
              <Save className="size-3.5" />
              Save Course Settings
            </Button>
          </form>
        </div>
      ) : null}

      {/* MODAL: ADD MODULE SHEET */}
      <Sheet open={isAddModuleOpen} onOpenChange={setIsAddModuleOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full p-6 space-y-4">
          <SheetHeader className="text-left border-b border-border/60 pb-3">
            <SheetTitle className="text-base font-bold">Add Module to Course</SheetTitle>
            <SheetDescription className="text-xs">
              Create a new curriculum module container for sections.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleAddModule} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="mod-name" className="font-semibold">Module Title *</Label>
              <Input
                id="mod-name"
                placeholder="e.g. Container Lifecycle & Storage"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="mod-threshold" className="font-semibold">Mastery Threshold</Label>
                <span className="font-mono text-primary font-bold">
                  {(newModuleThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="mod-threshold"
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={newModuleThreshold}
                onChange={(e) => setNewModuleThreshold(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <Button type="submit" size="sm" disabled={pending || !newModuleName} className="w-full">
              Add Module
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* MODAL: ADD SECTION SHEET */}
      <Sheet
        open={activeModuleForSection !== null}
        onOpenChange={(open) => !open && setActiveModuleForSection(null)}
      >
        <SheetContent side="right" className="sm:max-w-md w-full p-6 space-y-4">
          <SheetHeader className="text-left border-b border-border/60 pb-3">
            <SheetTitle className="text-base font-bold">Add Section to Module</SheetTitle>
            <SheetDescription className="text-xs">
              Organize concepts into logical pedagogical blocks.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleAddSection} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="sec-title" className="font-semibold">Section Title *</Label>
              <Input
                id="sec-title"
                placeholder="e.g. Linux POSIX & Namespaces"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec-desc" className="font-semibold">Description</Label>
              <Input
                id="sec-desc"
                placeholder="Key concepts covered in this section"
                value={newSectionDesc}
                onChange={(e) => setNewSectionDesc(e.target.value)}
              />
            </div>

            <Button type="submit" size="sm" disabled={pending || !newSectionTitle} className="w-full">
              Create Section
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* MODAL: ATTACH CONCEPT SHEET */}
      <Sheet
        open={activeSectionForConcept !== null}
        onOpenChange={(open) => !open && setActiveSectionForConcept(null)}
      >
        <SheetContent side="right" className="sm:max-w-md w-full p-6 space-y-4">
          <SheetHeader className="text-left border-b border-border/60 pb-3">
            <SheetTitle className="text-base font-bold">Attach Concept to Section</SheetTitle>
            <SheetDescription className="text-xs">
              Select an existing concept from your institute's catalog.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleAttachConcept} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="pick-concept" className="font-semibold">Choose Concept</Label>
              <select
                id="pick-concept"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                value={selectedConceptToAttach}
                onChange={(e) => setSelectedConceptToAttach(e.target.value)}
                required
              >
                <option value="">-- Select a Concept --</option>
                {detail.availableConcepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={pending || !selectedConceptToAttach}
              className="w-full"
            >
              Attach Concept
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
