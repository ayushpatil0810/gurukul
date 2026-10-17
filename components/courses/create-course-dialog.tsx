"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function CreateCourseDialog({
  batches,
  availableModules,
  onCreated,
}: {
  batches: { id: string; name: string }[];
  availableModules?: { id: string; name: string }[];
  onCreated?: (courseId: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [masteryThreshold, setMasteryThreshold] = useState(0.8);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate code slug from title if code is blank
  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code === "") {
      const generated = val
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join("-");
      if (generated) setCode(generated.slice(0, 12));
    }
  };

  const toggleBatch = (bId: string) => {
    setSelectedBatches((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId],
    );
  };

  const toggleModule = (mId: string) => {
    setSelectedModules((prev) =>
      prev.includes(mId) ? prev.filter((id) => id !== mId) : [...prev, mId],
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: code.trim().toUpperCase(),
          description,
          level,
          masteryThreshold,
          batchIds: selectedBatches,
          moduleIds: selectedModules,
        }),
      });

      const payload = (await res.json()) as {
        success: boolean;
        data?: { id: string };
        error?: { message?: string };
      };

      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to create course");
      }

      setOpen(false);
      setName("");
      setCode("");
      setDescription("");
      setSelectedBatches([]);
      setSelectedModules([]);
      router.refresh();
      if (payload.data?.id && onCreated) {
        onCreated(payload.data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-2 shadow-xs">
          <Plus className="size-4" />
          Create New Course
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md w-full p-6 space-y-6 overflow-y-auto">
        <SheetHeader className="text-left border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-4" />
            </span>
            <SheetTitle className="text-lg font-bold text-foreground">
              Create New Course
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Define course metadata, target threshold, and link initial cohort batches.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="course-name" className="text-xs font-semibold">Course Title *</Label>
            <Input
              id="course-name"
              placeholder="e.g. Cloud Native Systems & Kubernetes"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="course-code" className="text-xs font-semibold">Course Code *</Label>
              <Input
                id="course-code"
                placeholder="e.g. K8S-301"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-level" className="text-xs font-semibold">Difficulty Level</Label>
              <select
                id="course-level"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-desc" className="text-xs font-semibold">Description</Label>
            <textarea
              id="course-desc"
              rows={3}
              className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              placeholder="What will learners master in this course?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="course-thresh" className="text-xs font-semibold">Mastery Threshold</Label>
              <span className="font-mono text-xs font-bold text-primary">
                {(masteryThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              id="course-thresh"
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={masteryThreshold}
              onChange={(e) => setMasteryThreshold(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              Concepts reaching this probability are considered solid in this track.
            </p>
          </div>

          {/* Batches Selection */}
          {batches.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <Label className="text-xs font-semibold">Assign to Initial Batches</Label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2 text-xs">
                {batches.map((batch) => (
                  <label
                    key={batch.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBatches.includes(batch.id)}
                      onChange={() => toggleBatch(batch.id)}
                      className="rounded accent-primary"
                    />
                    <span className="font-medium text-foreground">{batch.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {/* Available Modules Selection */}
          {availableModules && availableModules.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <Label className="text-xs font-semibold">Link Existing Modules</Label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2 text-xs">
                {availableModules.map((mod) => (
                  <label
                    key={mod.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod.id)}
                      onChange={() => toggleModule(mod.id)}
                      className="rounded accent-primary"
                    />
                    <span className="font-medium text-foreground">{mod.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="pt-4 border-t border-border/60">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creating Course..." : "Create Course & Open Designer"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
