"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flame,
  Gavel,
  History,
  Info,
  Layers,
  MapPin,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { ReviewQueueItem } from "@/lib/services/integrity";
import { Button } from "@/components/ui/button";

interface IntegrityThreatMapProps {
  signals: ReviewQueueItem[];
  onSelectSignalForVerdict: (signal: ReviewQueueItem) => void;
}

function formatReplayTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function signalTypeLabel(type: string): string {
  switch (type) {
    case "large_paste":
      return "Large Paste";
    case "faster_than_rhythm":
      return "Typing Burst";
    case "no_write_run_fix":
      return "No-Iterate";
    case "evenly_typed":
      return "Uniform Cadence";
    case "explanation_mismatch":
      return "Explanation Mismatch";
    default:
      return type.replace(/_/g, " ");
  }
}

export function IntegrityThreatMap({
  signals,
  onSelectSignalForVerdict,
}: IntegrityThreatMapProps) {
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium">("all");

  const filteredSignals = useMemo(() => {
    if (severityFilter === "high") return signals.filter((s) => s.strength === "high");
    if (severityFilter === "medium") return signals.filter((s) => s.strength === "medium");
    return signals;
  }, [signals, severityFilter]);

  // Group by risk tier: High (&ge;80% conf / high strength), Medium, Low
  const groupedByTier = useMemo(() => {
    const high: ReviewQueueItem[] = [];
    const medium: ReviewQueueItem[] = [];
    const low: ReviewQueueItem[] = [];

    for (const s of filteredSignals) {
      if (s.strength === "high" || s.confidence >= 0.85) {
        high.push(s);
      } else if (s.strength === "medium" || s.confidence >= 0.6) {
        medium.push(s);
      } else {
        low.push(s);
      }
    }

    return { high, medium, low };
  }, [filteredSignals]);

  const selectedSignal = useMemo(
    () => signals.find((s) => s.id === selectedSignalId) ?? null,
    [signals, selectedSignalId]
  );

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs space-y-5">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-foreground">Integrity Threat & Anomaly Map</h2>
            <span className="rounded-md border border-border/80 bg-background/50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Cohort Risk Matrix
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Topological risk distribution of uniterated solutions, external code insertions, and velocity bursts.
          </p>
        </div>

        {/* SEVERITY TOGGLE */}
        <div className="flex items-center rounded-lg border border-border/70 bg-background p-0.5 text-xs">
          <button
            onClick={() => setSeverityFilter("all")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              severityFilter === "all"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Severity ({signals.length})
          </button>
          <button
            onClick={() => setSeverityFilter("high")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              severityFilter === "high"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            High Severity Only ({signals.filter((s) => s.strength === "high").length})
          </button>
        </div>
      </div>

      {/* LEGEND BAR */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground bg-muted/20 px-3.5 py-2 rounded-xl border border-border/50">
        <span className="font-semibold text-foreground text-xs">Status Indicators:</span>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-500 animate-pulse shadow-xs" />
          <span>Pending Review (Action Needed)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-purple-500 shadow-xs" />
          <span>Needs Viva (Interview Required)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span>Dismissed (Permissible / False Positive)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500 shadow-xs" />
          <span>Escalated (Formal Inquiry)</span>
        </div>
      </div>

      {/* RISK TIERS MATRIX GRID */}
      {signals.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Zero integrity threats flagged across your cohort! All student sessions passed with verified clean telemetry.
        </div>
      ) : (
        <div className="space-y-4">
          {/* HIGH RISK TIER */}
          {groupedByTier.high.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">
                  <Flame className="size-3.5" /> High Risk Threats ({groupedByTier.high.length})
                </span>
                <div className="h-px flex-1 bg-rose-500/20" />
                <span className="text-[10px] text-muted-foreground font-mono">Confidence &ge; 85%</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {groupedByTier.high.map((sig) => (
                  <SignalMapNode
                    key={sig.id}
                    signal={sig}
                    isSelected={selectedSignalId === sig.id}
                    onClick={() => setSelectedSignalId(selectedSignalId === sig.id ? null : sig.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* MEDIUM RISK TIER */}
          {groupedByTier.medium.length > 0 && severityFilter !== "high" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 font-mono">
                  <AlertTriangle className="size-3.5" /> Moderate Telemetry Anomalies ({groupedByTier.medium.length})
                </span>
                <div className="h-px flex-1 bg-amber-500/20" />
                <span className="text-[10px] text-muted-foreground font-mono">Confidence 60–84%</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {groupedByTier.medium.map((sig) => (
                  <SignalMapNode
                    key={sig.id}
                    signal={sig}
                    isSelected={selectedSignalId === sig.id}
                    onClick={() => setSelectedSignalId(selectedSignalId === sig.id ? null : sig.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* LOW RISK TIER */}
          {groupedByTier.low.length > 0 && severityFilter === "all" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-400 font-mono">
                  <Info className="size-3.5" /> Subtle Cadence Signals ({groupedByTier.low.length})
                </span>
                <div className="h-px flex-1 bg-blue-500/20" />
                <span className="text-[10px] text-muted-foreground font-mono">Confidence &lt; 60%</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {groupedByTier.low.map((sig) => (
                  <SignalMapNode
                    key={sig.id}
                    signal={sig}
                    isSelected={selectedSignalId === sig.id}
                    onClick={() => setSelectedSignalId(selectedSignalId === sig.id ? null : sig.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* SELECTED SIGNAL QUICK ACTION PREVIEW BAR */}
      {selectedSignal ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-xs space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{selectedSignal.studentName}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-semibold text-primary">{signalTypeLabel(selectedSignal.type)}</span>
                {selectedSignal.batchName ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {selectedSignal.batchName}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-foreground line-clamp-1">{selectedSignal.explanation}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono pt-0.5">
                <span>Confidence: {Math.round(selectedSignal.confidence * 100)}%</span>
                <span>Flagged at: {formatReplayTime(selectedSignal.tStart)}</span>
                <span className="font-bold uppercase text-foreground">Status: {selectedSignal.reviewStatus.replace(/_/g, " ")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectSignalForVerdict(selectedSignal)}
                className="h-8 gap-1.5 text-xs border-primary/40 bg-background hover:bg-primary/10"
              >
                <Gavel className="h-3.5 w-3.5 text-primary" />
                <span>Triage Verdict ⚖️</span>
              </Button>

              <Button asChild size="sm" className="h-8 gap-1.5 text-xs shadow-xs">
                <Link href={`/replay/${selectedSignal.sessionId}?t=${Math.round(selectedSignal.tStart * 1000)}`}>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Play at {formatReplayTime(selectedSignal.tStart)} &rarr;</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SignalMapNode({
  signal,
  isSelected,
  onClick,
}: {
  signal: ReviewQueueItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  let statusColor = "bg-rose-500";
  let statusBorder = "border-rose-500/30";

  switch (signal.reviewStatus) {
    case "needs_viva":
      statusColor = "bg-purple-500";
      statusBorder = "border-purple-500/30";
      break;
    case "dismissed":
      statusColor = "bg-emerald-500";
      statusBorder = "border-emerald-500/30";
      break;
    case "escalated":
      statusColor = "bg-amber-500";
      statusBorder = "border-amber-500/30";
      break;
    default:
      statusColor = "bg-rose-500 animate-pulse";
      statusBorder = "border-rose-500/50";
      break;
  }

  return (
    <div
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-3 shadow-2xs transition-all hover:shadow-xs bg-card/90 ${statusBorder} ${
        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-foreground/30"
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`size-2 shrink-0 rounded-full ${statusColor}`} />
            <span className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
              {signal.studentName}
            </span>
          </div>
          <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase">
            {signalTypeLabel(signal.type)}
          </span>
        </div>

        <p className="line-clamp-1 text-[11px] text-muted-foreground font-sans">
          {signal.explanation}
        </p>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground font-mono">
        <span>{formatReplayTime(signal.tStart)}</span>
        <span className="font-semibold text-foreground">{Math.round(signal.confidence * 100)}% Conf</span>
      </div>
    </div>
  );
}
