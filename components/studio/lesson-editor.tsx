"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { LessonView } from "@/components/lessons/lesson-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LessonCodeLanguage } from "@/lib/engine/lesson-languages";
import type { LessonAuthorView } from "@/lib/services/lessons";
import { cn } from "cn";

type OutlineDraft = {
  id: string;
  type: "slide" | "quiz" | "interactive";
  title: string;
  description: string;
  keyPoints: string;
  quizConfig?: LessonAuthorView["outlines"][number]["quizConfig"];
};

export function LessonEditor({ lesson }: { lesson: LessonAuthorView }) {
  const [view, setView] = useState(lesson);
  const [outlines, setOutlines] = useState<OutlineDraft[]>(() => toDrafts(lesson));
  const [bodies, setBodies] = useState<Record<string, string>>(() => bodyMap(lesson));
  const [codeLanguage, setCodeLanguage] = useState<LessonCodeLanguage | "">(lesson.codeLanguage ?? "");
  const [activeTab, setActiveTab] = useState<"outline" | "scenes" | "validation">("outline");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function adopt(next: LessonAuthorView, message: string) {
    setView(next);
    setOutlines(toDrafts(next));
    setBodies(bodyMap(next));
    setCodeLanguage(next.codeLanguage ?? "");
    setNotice(message);
    setError("");
  }

  async function send(action: string, path: string, method: "PATCH" | "POST", payload: unknown, message: string) {
    setPending(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { data?: LessonAuthorView; error?: { message?: string } };
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "The lesson was not changed.");
        return;
      }
      adopt(body.data, message);
    } catch {
      setError("The lesson was not changed.");
    } finally {
      setPending("");
    }
  }

  const busy = pending.length > 0;
  const errors = view.issues.filter((issue) => issue.severity === "error");
  const warnings = view.issues.filter((issue) => issue.severity === "warning");
  const dirty =
    outlines.some((outline, index) => {
      const saved = view.outlines[index];
      return (
        !saved ||
        outline.title !== saved.title ||
        outline.description !== saved.description ||
        outline.keyPoints !== (saved.keyPoints ?? []).join("\n")
      );
    }) || codeLanguage !== (view.codeLanguage ?? "");

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  return (
    <div className="space-y-8">
      {/* TOP HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/studio"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3" />
              Lesson Studio
            </Link>
            <span className="text-muted-foreground/60">•</span>
            <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {view.conceptName}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {view.moduleName}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                view.status === "published"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
              )}
            >
              {view.status === "published" ? "Published & Live" : "Draft Mode"}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {view.title}
          </h1>

          <p className="text-xs text-muted-foreground max-w-2xl">
            {view.topic || "Pedagogical walkthrough for concept mastery."}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {view.status !== "published" ? (
            <Button
              size="sm"
              disabled={busy || errors.length > 0 || view.scenes.length === 0}
              onClick={() =>
                send(
                  "publish",
                  `/api/lessons/${view.id}/publish`,
                  "POST",
                  { version: view.version },
                  "Lesson published successfully! Students on this concept will now receive it in their adaptive learning loop.",
                )
              }
              className="gap-1.5 font-semibold shadow-xs"
            >
              <Send className="size-3.5" />
              {pending === "publish" ? "Publishing…" : "Publish Lesson"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> Live for Enrolled Students
            </span>
          )}
        </div>
      </div>

      {/* 4-STAGE PEDAGOGICAL WORKFLOW PROGRESS BAR */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            step: "01",
            title: "Requirements",
            desc: "Concept & calibration",
            completed: true,
          },
          {
            step: "02",
            title: "Outline Architecture",
            desc: `${outlines.length} scene outlines defined`,
            completed: outlines.length > 0,
            active: activeTab === "outline",
          },
          {
            step: "03",
            title: "Scenes & Player",
            desc: view.scenes.length > 0 ? `${view.scenes.length} scenes synthesized` : "Content pending",
            completed: view.scenes.length > 0,
            active: activeTab === "scenes",
          },
          {
            step: "04",
            title: "Safety & Publish",
            desc: errors.length > 0 ? `${errors.length} blocking issues` : "0 blocking errors",
            completed: view.status === "published",
            active: activeTab === "validation",
          },
        ].map((item) => (
          <div
            key={item.step}
            className={cn(
              "rounded-xl border p-3 transition-all",
              item.active
                ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                : item.completed
                  ? "border-border/80 bg-card/80"
                  : "border-border/50 bg-muted/20 opacity-70",
            )}
          >
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="font-bold text-muted-foreground">{item.step}</span>
              {item.completed ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : (
                <span className="size-2 rounded-full bg-border" />
              )}
            </div>
            <div className="mt-1 font-semibold text-xs text-foreground truncate">{item.title}</div>
            <div className="text-[10px] text-muted-foreground truncate">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* GLOBAL ALERTS */}
      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Action could not be completed</span>
            <p className="text-destructive/90">{error}</p>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* 3 WORKSPACE TABS */}
      <div className="flex items-center gap-1 border-b border-border/70 pb-px text-xs font-medium">
        <button
          onClick={() => setActiveTab("outline")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer font-semibold",
            activeTab === "outline"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="size-4" />
          <span>1. Outline Architecture</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
            {outlines.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("scenes")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer font-semibold",
            activeTab === "scenes"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Eye className="size-4" />
          <span>2. Scene Content & Live Preview</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
            {view.scenes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("validation")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer font-semibold",
            activeTab === "validation"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <ShieldCheck className="size-4" />
          <span>3. Pre-Publish Audit</span>
          {errors.length > 0 ? (
            <span className="rounded-full bg-destructive/15 text-destructive px-1.5 py-0.2 text-[10px] font-mono font-bold">
              {errors.length}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono font-bold">
              ✓
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OUTLINE ARCHITECTURE */}
      {activeTab === "outline" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Structured Scene Outline</h2>
              <p className="text-xs text-muted-foreground">
                Each card represents a scene in the student walkthrough. Formulate key ideas before full text synthesis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  send(
                    "outline",
                    `/api/lessons/${view.id}`,
                    "PATCH",
                    outlinePayload(),
                    "Outline changes saved successfully.",
                  )
                }
                className="gap-1.5 text-xs font-semibold"
              >
                <Save className="size-3.5" />
                {pending === "outline" ? "Saving…" : "Save Outline"}
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={busy || view.status === "published"}
                onClick={() =>
                  send(
                    "content",
                    `/api/lessons/${view.id}/content`,
                    "POST",
                    { version: view.version },
                    "Lesson scenes synthesized successfully. Review the live student preview.",
                  )
                }
                className="gap-1.5 text-xs font-semibold"
              >
                <Sparkles className="size-3.5" />
                {pending === "content" ? "Synthesizing Content…" : "Synthesize Scene Content →"}
              </Button>
            </div>
          </div>

          {/* Language Selection Card */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Code2 className="size-4 text-primary" />
                <span>Code Example Syntax Sandbox</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Specifies syntax rules and language AST checker for examples across all scenes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                id="code-language"
                value={codeLanguage}
                onChange={(event) => setCodeLanguage(event.target.value as LessonCodeLanguage | "")}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground"
              >
                <option value="">Not Recorded (Prose Only)</option>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java (Standard Syntax)</option>
                <option value="cpp">C++ (POSIX / Modern)</option>
              </select>
            </div>
          </div>

          {/* Outline Scene Cards List */}
          <div className="space-y-4">
            {outlines.map((outline, index) => (
              <div
                key={outline.id}
                className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-4 transition-all hover:border-border-strong"
              >
                {/* Scene Header */}
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Scene {index + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Type:</span>
                    <select
                      value={outline.type}
                      onChange={(event) =>
                        updateOutline(index, {
                          type: event.target.value === "quiz" ? "quiz" : "slide",
                        })
                      }
                      className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground"
                    >
                      <option value="slide">Slide (Walkthrough & Code)</option>
                      <option value="quiz">Formative Knowledge Check</option>
                    </select>
                  </div>
                </div>

                {/* Title & Description Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Scene Title *</Label>
                    <Input
                      value={outline.title}
                      onChange={(event) => updateOutline(index, { title: event.target.value })}
                      placeholder="e.g. Type Narrowing via Control Flow"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Description / Objective</Label>
                    <Input
                      value={outline.description}
                      onChange={(event) => updateOutline(index, { description: event.target.value })}
                      placeholder="High-level goal for this scene"
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Key Points */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Key Pedagogical Points (One per line)</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {outline.keyPoints.split("\n").filter((p) => p.trim()).length} points defined
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={outline.keyPoints}
                    onChange={(event) => updateOutline(index, { keyPoints: event.target.value })}
                    placeholder="• First fundamental concept&#10;• Common pitfall to avoid&#10;• Practical code pattern"
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* TAB 2: SCENES CONTENT & LIVE STUDENT PLAYER */}
      {activeTab === "scenes" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Scene Synthesis & Interactive Player</h2>
              <p className="text-xs text-muted-foreground">
                Edit synthesized prose, fine-tune code walkthroughs, and observe the exact learner experience in real-time.
              </p>
            </div>

            {view.scenes.length > 0 ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  send(
                    "scenes",
                    `/api/lessons/${view.id}`,
                    "PATCH",
                    scenePayload(),
                    "Manual scene text edits saved successfully.",
                  )
                }
                className="gap-1.5 text-xs font-semibold"
              >
                <Save className="size-3.5" />
                {pending === "scenes" ? "Saving Edits…" : "Save Scene Edits"}
              </Button>
            ) : null}
          </div>

          {view.scenes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-card p-10 text-center space-y-3">
              <Sparkles className="size-8 text-primary mx-auto animate-pulse" />
              <h3 className="font-bold text-base text-foreground">Content Not Synthesized Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Your outline architecture is ready. Click below to generate full scenes, prose explanations, and code examples.
              </p>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  send(
                    "content",
                    `/api/lessons/${view.id}/content`,
                    "POST",
                    { version: view.version },
                    "Lesson content generated.",
                  )
                }
                className="gap-2 text-xs font-semibold"
              >
                <Sparkles className="size-3.5" />
                Synthesize Scene Content Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Left Column: Scene Text Editors */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Scene Prose & Code ({view.scenes.length} Scenes)
                  </h3>
                </div>

                {view.scenes.map((scene, idx) => (
                  <div
                    key={scene.id}
                    className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold font-mono">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-xs text-foreground">{scene.title}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase">
                          {scene.role}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            send(
                              `scene:${scene.id}`,
                              `/api/lessons/${view.id}/content`,
                              "POST",
                              { version: view.version, outlineId: scene.outlineId },
                              "Scene regenerated with updated synthesis.",
                            )
                          }
                          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw className={cn("size-3", pending === `scene:${scene.id}` && "animate-spin")} />
                          Regen
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`body-${scene.id}`} className="text-[11px] font-medium text-muted-foreground">
                        Paragraph & Explanation Content
                      </Label>
                      <textarea
                        id={`body-${scene.id}`}
                        rows={5}
                        value={bodies[scene.id] ?? scene.paragraphs.join("\n\n")}
                        onChange={(event) =>
                          setBodies((current) => ({ ...current, [scene.id]: event.target.value }))
                        }
                        className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono leading-relaxed text-foreground placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column: Live Mock Classroom Player */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Live Learner Player
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Interactive
                  </span>
                </div>

                <div className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-sm">
                  {/* Mock Classroom Header Bar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/40 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground truncate max-w-[200px]">
                      {view.title}
                    </span>
                    <span className="rounded bg-background px-2 py-0.5 font-mono text-[10px] border border-border/50">
                      Student Preview
                    </span>
                  </div>

                  <div className="p-4">
                    <LessonView
                      lessonId={view.id}
                      lessonTitle={view.title}
                      conceptName={view.conceptName}
                      scenes={view.scenes}
                      showAnswers
                      codeLanguage={view.codeLanguage}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* TAB 3: PRE-PUBLISH VALIDATION & AUDIT */}
      {activeTab === "validation" ? (
        <div className="space-y-6 max-w-3xl">
          <div>
            <h2 className="text-base font-bold text-foreground">Syntax & Language Safety Audit</h2>
            <p className="text-xs text-muted-foreground">
              Every lesson undergoes rigorous AST parsing and pedagogy heuristics to ensure safe execution in the student sandbox.
            </p>
          </div>

          {/* Health Assessment Card */}
          {errors.length === 0 && warnings.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-3 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2.5 text-sm font-bold">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span>All Pre-flight Quality & Syntax Checks Passed</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                No syntax hallucinations, invalid code constructs, or unhandled language blocks were found. The lesson is verified and ready for live student delivery.
              </p>
            </div>
          ) : null}

          {/* Blocking Errors */}
          {errors.length > 0 ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 space-y-3 text-xs text-destructive">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="size-4.5" />
                <span>Blocking Validation Issues ({errors.length})</span>
              </div>
              <ul className="space-y-2 list-disc list-inside text-destructive/90 pl-1">
                {errors.map((issue, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{issue.sceneTitle}:</span> {issue.message}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground pt-1">
                Blocking issues must be repaired in the Scene Editor or regenerated before publication is permitted.
              </p>
            </div>
          ) : null}

          {/* Warnings */}
          {warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="size-4.5" />
                <span>Pedagogical Warnings ({warnings.length})</span>
              </div>
              <ul className="space-y-1.5 list-disc list-inside text-muted-foreground pl-1">
                {warnings.map((issue, idx) => (
                  <li key={idx}>
                    <span className="font-semibold text-foreground">{issue.sceneTitle}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Publish Final Action Card */}
          <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">Publication Status</h3>
              <p className="text-xs text-muted-foreground">
                {view.status === "published"
                  ? "This lesson is currently published and active in learner feeds."
                  : "Publishing releases this lesson to students whose knowledge state targets this concept."}
              </p>
            </div>

            {view.status !== "published" ? (
              <Button
                size="sm"
                disabled={busy || errors.length > 0 || view.scenes.length === 0}
                onClick={() =>
                  send(
                    "publish",
                    `/api/lessons/${view.id}/publish`,
                    "POST",
                    { version: view.version },
                    "Lesson published successfully! Students on this concept can now study it.",
                  )
                }
                className="gap-2 font-semibold shadow-xs"
              >
                <Send className="size-4" />
                {pending === "publish" ? "Publishing…" : "Publish Lesson"}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> Published & Live
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );

  function updateOutline(index: number, patch: Partial<OutlineDraft>) {
    setOutlines((current) =>
      current.map((outline, item) => (item === index ? { ...outline, ...patch } : outline)),
    );
  }

  function outlinePayload() {
    return {
      version: view.version,
      outlines: outlines.map((outline, index) => ({
        id: outline.id,
        type: outline.type,
        title: outline.title,
        description: outline.description,
        keyPoints: outline.keyPoints
          .split("\n")
          .map((point) => point.trim())
          .filter(Boolean),
        order: index + 1,
        quizConfig: outline.quizConfig,
      })),
      codeLanguage: codeLanguage || undefined,
    };
  }

  function scenePayload() {
    return {
      version: view.version,
      scenes: view.scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        body: bodies[scene.id] ?? scene.paragraphs.join("\n\n"),
        questions: scene.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          options: question.options,
        })),
      })),
    };
  }
}

function toDrafts(lesson: LessonAuthorView): OutlineDraft[] {
  return lesson.outlines.map((outline) => ({
    id: outline.id,
    type:
      outline.type === "quiz"
        ? "quiz"
        : (outline.type as string) === "interactive"
          ? "interactive"
          : "slide",
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints ?? []).join("\n"),
    quizConfig: outline.quizConfig,
  }));
}

function bodyMap(lesson: LessonAuthorView): Record<string, string> {
  return Object.fromEntries(
    lesson.scenes.map((scene) => [scene.id, scene.paragraphs.join("\n\n")]),
  );
}
