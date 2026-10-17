"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  Layers,
  GraduationCap,
  Clock,
  Code2,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

type ModuleOption = { id: string; name: string; conceptIds: string[] };
type ConceptOption = { id: string; name: string };

export function NewLessonForm({
  modules,
  concepts,
}: {
  modules: ModuleOption[];
  concepts: ConceptOption[];
}) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [conceptId, setConceptId] = useState("");
  const [topic, setTopic] = useState("");
  const [objectives, setObjectives] = useState("");
  const [learnerLevel, setLearnerLevel] = useState("beginner");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("typescript");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const conceptChoices = useMemo(() => {
    const selectedModule = modules.find((item) => item.id === moduleId);
    const allowed = new Set(selectedModule?.conceptIds ?? []);
    return concepts.filter((concept) => allowed.has(concept.id));
  }, [concepts, moduleId, modules]);

  const selectedConcept = conceptChoices.some((concept) => concept.id === conceptId)
    ? conceptId
    : (conceptChoices[0]?.id ?? "");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          moduleId,
          conceptId: selectedConcept,
          topic,
          objectives,
          learnerLevel,
          durationMinutes: Number(durationMinutes),
          sourceMaterial,
          codeLanguage,
        }),
      });
      const body = (await response.json()) as {
        success?: boolean;
        data?: { id: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "The outline was not created.");
        return;
      }
      router.push(`/studio/${body.data.id}`);
    } catch {
      setError("The outline was not created.");
    } finally {
      setPending(false);
    }
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-card p-8 text-center text-sm text-muted-foreground space-y-2">
        <BookOpen className="size-8 text-muted-foreground/50 mx-auto" />
        <h3 className="font-semibold text-foreground">No Curriculum Modules Available</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          This institute has no modules yet. Please configure a module and concept on Course Management before authoring lessons.
        </p>
        <Link href="/curriculum" className="inline-block pt-2">
          <Button size="sm" variant="outline" className="text-xs">
            Open Course Management
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* FORM COLUMN */}
      <form onSubmit={onSubmit} className="space-y-6">
        {error ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to initiate lesson</p>
              <p className="mt-0.5 text-destructive/90">{error}</p>
            </div>
          </div>
        ) : null}

        {/* CARD 1: CURRICULUM MAPPING */}
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/50 pb-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">1. Curriculum Alignment</h2>
              <p className="text-[11px] text-muted-foreground">
                Select where this interactive walkthrough belongs in the prerequisite knowledge graph.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="module" className="text-xs font-semibold">
                Parent Module *
              </Label>
              <select
                id="module"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground"
                value={moduleId}
                onChange={(event) => setModuleId(event.target.value)}
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name} ({module.conceptIds.length} concepts)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="concept" className="text-xs font-semibold">
                Anchor Concept *
              </Label>
              <select
                id="concept"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground"
                value={selectedConcept}
                onChange={(event) => setConceptId(event.target.value)}
              >
                {conceptChoices.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CARD 2: TOPIC & OBJECTIVES */}
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/50 pb-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FileText className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">2. Pedagogical Scope & Objectives</h2>
              <p className="text-[11px] text-muted-foreground">
                Define the specific cognitive objective, practical examples, and core mental model.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="topic" className="font-semibold">
                Lesson Topic Title *
              </Label>
              <Input
                id="topic"
                placeholder="e.g. Type Narrowing & Discriminated Unions in TypeScript"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                required
                maxLength={200}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                A concise, learner-facing title identifying the practical technique or concept.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="objectives" className="font-semibold">
                Core Learning Objectives *
              </Label>
              <textarea
                id="objectives"
                rows={4}
                placeholder="• Understand how TypeScript evaluates control flow type guards.&#10;• Contrast typeof and instanceof checks with custom user-defined type predicates.&#10;• Apply discriminated union patterns to eliminate runtime undefined errors."
                value={objectives}
                onChange={(event) => setObjectives(event.target.value)}
                required
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: CALIBRATION & CODE SETTINGS */}
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/50 pb-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sliders className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">3. Delivery Calibration & Language</h2>
              <p className="text-[11px] text-muted-foreground">
                Set target audience difficulty level, length, and code syntax sandbox.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Learner Level Cards */}
            <div className="space-y-2">
              <Label className="font-semibold">Target Learner Level</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "beginner", label: "Beginner", desc: "Foundational mental models & primitives" },
                  { id: "intermediate", label: "Intermediate", desc: "Composition patterns & architecture" },
                  { id: "advanced", label: "Advanced", desc: "High-performance edge cases & internals" },
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setLearnerLevel(lvl.id)}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer",
                      learnerLevel === lvl.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                        : "border-border/70 bg-background/50 hover:bg-muted/30",
                    )}
                  >
                    <span className="font-bold text-xs text-foreground">{lvl.label}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{lvl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              {/* Duration selector */}
              <div className="space-y-1.5">
                <Label htmlFor="duration" className="font-semibold">
                  Estimated Completion (Minutes)
                </Label>
                <div className="flex items-center gap-2">
                  {["10", "15", "20", "30"].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={cn(
                        "flex-1 py-1.5 text-xs rounded-md border font-mono font-medium transition-colors cursor-pointer",
                        durationMinutes === mins
                          ? "bg-primary text-primary-foreground border-primary font-bold"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Code language */}
              <div className="space-y-1.5">
                <Label htmlFor="code-language" className="font-semibold">
                  Programming Language for Code
                </Label>
                <select
                  id="code-language"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground"
                  value={codeLanguage}
                  onChange={(event) => setCodeLanguage(event.target.value)}
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java (Standard Syntax)</option>
                  <option value="cpp">C++ (POSIX / Modern)</option>
                </select>
              </div>
            </div>

            {/* Optional Source Material */}
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="source" className="font-semibold text-muted-foreground">
                Optional Reference Material / Context Snippet
              </Label>
              <textarea
                id="source"
                rows={2}
                placeholder="Paste code snippet, doc reference, or textbook excerpt to anchor the synthesizer."
                value={sourceMaterial}
                onChange={(event) => setSourceMaterial(event.target.value)}
                maxLength={4000}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <Link href="/studio">
            <Button type="button" variant="outline" size="sm" className="text-xs">
              &larr; Cancel & Return to Studio
            </Button>
          </Link>

          <Button
            type="submit"
            disabled={pending || !topic || !objectives}
            className="gap-2 font-semibold shadow-xs"
          >
            <Sparkles className="size-4" />
            {pending ? "Synthesizing Pedagogical Outline…" : "Generate Pedagogical Outline →"}
          </Button>
        </div>
      </form>

      {/* RIGHT SIDEBAR: EXPLAINER & GUIDELINES */}
      <div className="space-y-5">
        {/* Card: Authoring Process */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
            <Lightbulb className="size-4 text-amber-500" />
            <span>Authoring Workflow</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
                1
              </span>
              <div>
                <p className="font-semibold text-foreground">Structured Outline First</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  The AI drafts an editable outline of slides and quizzes before full text is generated.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
                2
              </span>
              <div>
                <p className="font-semibold text-foreground">Human-in-the-Loop Review</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  You can edit scene titles, key points, or regenerate specific scenes on demand.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
                3
              </span>
              <div>
                <p className="font-semibold text-foreground">Strict Syntax Validation</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Code examples undergo automated AST parsing to guarantee zero syntax hallucinations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Pedagogy Best Practices */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
            <GraduationCap className="size-4 text-primary" />
            <span>Pedagogical Best Practices</span>
          </div>

          <ul className="space-y-2 text-[11px] text-muted-foreground leading-relaxed list-disc list-inside">
            <li><span className="text-foreground font-medium">One Obstacle Per Lesson:</span> Focus on a single distinct concept to minimize cognitive overload.</li>
            <li><span className="text-foreground font-medium">3 to 5 Scenes:</span> Research shows micro-lessons between 10-15 minutes maximize student retention.</li>
            <li><span className="text-foreground font-medium">Formative Check:</span> Always end with an active multiple-choice quiz testing understanding.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
