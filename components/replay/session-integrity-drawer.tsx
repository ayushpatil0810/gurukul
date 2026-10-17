"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  History,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Zap,
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
import type { ReplaySessionSummary } from "@/lib/services/replay";

type SignalItem = {
  id: string;
  sessionId: string;
  studentName: string;
  type: string;
  strength: string;
  confidence: number;
  reviewStatus: string;
  tStart: number;
  tEnd: number;
  explanation: string;
  replayHref: string;
};

interface SessionIntegrityDrawerProps {
  session: ReplaySessionSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatSessionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function signalTypeLabel(type: string): string {
  switch (type) {
    case "large_paste":
      return "Large Code Paste";
    case "faster_than_rhythm":
      return "Unusual Typing Burst";
    case "no_write_run_fix":
      return "No Write-Run-Fix Loop";
    case "evenly_typed":
      return "Unusually Uniform Cadence";
    case "explanation_mismatch":
      return "Explanation Mismatch";
    default:
      return type.replace(/_/g, " ");
  }
}

export function SessionIntegrityDrawer({
  session,
  isOpen,
  onClose,
}: SessionIntegrityDrawerProps) {
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !session) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/sessions/${session.id}/signals`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load integrity signals");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setSignals(Array.isArray(data.data) ? data.data : []);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, session]);

  const triggerScan = async () => {
    if (!session) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/signals`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message ?? "Scan failed");
      }
      setSignals(data.data.signals ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to scan session");
    } finally {
      setScanning(false);
    }
  };

  if (!session) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-foreground">
                Session Integrity Audit
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Automated keystroke heuristics and behavioral anomaly analysis.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* SESSION SUMMARY CARD */}
        <div className="my-4 rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">{session.studentName}</p>
              {session.studentEmail ? (
                <p className="text-[11px] text-muted-foreground">{session.studentEmail}</p>
              ) : null}
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${
                session.mode === "graded"
                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
              }`}
            >
              {session.mode === "graded" ? "Online Assessment (OA)" : "Practice Lab"}
            </span>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground font-mono">
            <p className="line-clamp-2 text-foreground font-sans text-xs">
              {session.questionStatement}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
              <span>Started: {new Date(session.startedAt).toLocaleString()}</span>
              {session.durationSeconds ? (
                <span>Duration: {formatSessionTime(session.durationSeconds)}</span>
              ) : null}
              {typeof session.passRate === "number" ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Pass Rate: {Math.round(session.passRate * 100)}%
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerScan}
              disabled={scanning}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Running Scan…" : "Run On-Demand Scan"}
            </Button>

            <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={`/replay/${session.id}`}>
                <Play className="h-3.5 w-3.5 fill-current" />
                Play Full Replay
              </Link>
            </Button>
          </div>
        </div>

        {/* INTEGRITY STATUS & SIGNALS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Detected Integrity Signals ({signals.length})
            </h3>
            {signals.length > 0 ? (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Review Recommended
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-xl border border-border/70 p-8 text-center text-xs text-muted-foreground animate-pulse">
              Loading integrity telemetry…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
              {error}
            </div>
          ) : signals.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-2">
              <ShieldCheck className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-foreground">Clean Session Telemetry</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No copy-paste anomalies, impossible typing speed bursts, or uniterated solutions were detected for this session.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((sig) => {
                const isHigh = sig.strength === "high";
                return (
                  <div
                    key={sig.id}
                    className={`rounded-xl border p-4 shadow-xs space-y-3 transition-colors ${
                      isHigh
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-amber-500/30 bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {signalTypeLabel(sig.type)}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase ${
                              isHigh
                                ? "bg-destructive/20 text-destructive"
                                : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {sig.strength} severity
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Confidence: <span className="font-semibold font-mono text-foreground">{Math.round(sig.confidence * 100)}%</span> · Detected around <span className="font-mono text-foreground font-semibold">{formatSessionTime(sig.tStart)}</span>
                        </p>
                      </div>

                      <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-[10px] font-medium border border-border/60 uppercase">
                        {sig.reviewStatus}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed bg-background/60 p-3 rounded-lg border border-border/50">
                      {sig.explanation}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                      <Link
                        href={`/replay/${session.id}?t=${Math.round(sig.tStart * 1000)}`}
                        className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline underline-offset-4"
                      >
                        <History className="h-3.5 w-3.5" />
                        Scrub to {formatSessionTime(sig.tStart)} in Replay
                      </Link>

                      <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Link href={`/review/${sig.id}`}>
                          <span>Open Review Verdict</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
