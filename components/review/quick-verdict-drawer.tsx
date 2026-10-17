"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flame,
  Gavel,
  History,
  Info,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ReviewQueueItem, ReviewDisposition } from "@/lib/services/integrity";

interface QuickVerdictDrawerProps {
  signal: ReviewQueueItem | null;
  isOpen: boolean;
  onClose: () => void;
  onVerdictApplied?: (signalId: string, disposition: string) => void;
}

function formatReplayTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function signalTypeLabel(type: string): string {
  switch (type) {
    case "large_paste":
      return "Large Code Paste";
    case "faster_than_rhythm":
      return "Unusual Typing Velocity Burst";
    case "no_write_run_fix":
      return "No Write-Run-Fix Iteration";
    case "evenly_typed":
      return "Unusually Uniform Cadence";
    case "explanation_mismatch":
      return "Explanation Mismatch";
    default:
      return type.replace(/_/g, " ");
  }
}

export function QuickVerdictDrawer({
  signal,
  isOpen,
  onClose,
  onVerdictApplied,
}: QuickVerdictDrawerProps) {
  const [disposition, setDisposition] = useState<ReviewDisposition | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!signal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposition) {
      setError("Please select a disposition decision.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/signals/${signal.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition, note }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to save verdict.");
      }
      setSuccessMessage("Verdict successfully recorded!");
      if (onVerdictApplied) {
        onVerdictApplied(signal.id, disposition);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message ?? "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const isHigh = signal.strength === "high";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-5">
        <SheetHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-foreground">
                Integrity Triage & Verdict
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Review automated telemetry heuristics and record a formal disposition.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ANOMALY PROFILE CARD */}
        <div
          className={`rounded-2xl border p-4 shadow-xs space-y-3 ${
            isHigh
              ? "border-destructive/30 bg-destructive/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  {signalTypeLabel(signal.type)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase ${
                    isHigh
                      ? "bg-destructive/20 text-destructive"
                      : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {signal.strength} severity
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Confidence: <strong className="text-foreground">{Math.round(signal.confidence * 100)}%</strong> · Detected at <strong className="text-foreground">{formatReplayTime(signal.tStart)}</strong>
              </p>
            </div>

            <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase border border-border/60">
              {signal.reviewStatus.replace(/_/g, " ")}
            </span>
          </div>

          <div className="rounded-lg bg-background/60 p-3 text-xs text-muted-foreground border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-foreground font-semibold">
              <span>{signal.studentName}</span>
              {signal.batchName ? (
                <span className="text-muted-foreground font-mono text-[11px] font-normal">
                  {signal.batchName}
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 text-foreground font-sans text-xs">
              Challenge: {signal.questionStatement}
            </p>
          </div>

          <p className="text-xs text-foreground/90 leading-relaxed bg-background/50 p-3 rounded-lg border border-border/40">
            {signal.explanation}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
            <Link
              href={`/replay/${signal.sessionId}?t=${Math.round(signal.tStart * 1000)}`}
              className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline underline-offset-4"
            >
              <History className="h-3.5 w-3.5" />
              Scrub to {formatReplayTime(signal.tStart)} in Replay &rarr;
            </Link>

            <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <Link href={`/review/${signal.id}`}>
                <span>Full Review Page</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>

        {/* DECISION FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="space-y-1 border-b border-border/60 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
              Record Review Verdict
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Select an action based on your review of the student&apos;s keystroke replay.
            </p>
          </div>

          <div className="space-y-2">
            {/* OPTION 1: DISMISS */}
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                disposition === "dismissed"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-border/70 hover:bg-muted/30"
              }`}
            >
              <input
                type="radio"
                name="disposition"
                value="dismissed"
                checked={disposition === "dismissed"}
                onChange={() => setDisposition("dismissed")}
                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Dismiss (Permissible Pattern / False Positive)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  The anomaly was acceptable boilerplate, assistive tooling, or valid reference typing.
                </p>
              </div>
            </label>

            {/* OPTION 2: NEEDS VIVA */}
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                disposition === "needs_viva"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-border/70 hover:bg-muted/30"
              }`}
            >
              <input
                type="radio"
                name="disposition"
                value="needs_viva"
                checked={disposition === "needs_viva"}
                onChange={() => setDisposition("needs_viva")}
                className="mt-0.5 text-purple-600 focus:ring-purple-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  Needs Viva (Oral Code Defense Required)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Schedule a viva interview with the student to verify genuine conceptual comprehension.
                </p>
              </div>
            </label>

            {/* OPTION 3: ESCALATE */}
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                disposition === "escalated"
                  ? "border-destructive bg-destructive/10"
                  : "border-border/70 hover:bg-muted/30"
              }`}
            >
              <input
                type="radio"
                name="disposition"
                value="escalated"
                checked={disposition === "escalated"}
                onChange={() => setDisposition("escalated")}
                className="mt-0.5 text-destructive focus:ring-destructive"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                  Escalate to Academic Committee
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Strong evidence of unauthorized external code generation or plagiarism requiring formal escalation.
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-1.5 pt-1">
            <label htmlFor="verdict-note" className="text-xs font-medium text-foreground">
              Reviewer Notes (Optional)
            </label>
            <textarea
              id="verdict-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Student pasted 300 lines without prior typing. Viva scheduled for Monday."
              className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !disposition} className="h-8 text-xs gap-1.5">
              <Gavel className="h-3.5 w-3.5" />
              {submitting ? "Saving Verdict…" : "Save Verdict"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
