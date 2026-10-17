"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Flame,
  Gavel,
  History,
  Info,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import type { ReviewQueueItem } from "@/lib/services/integrity";
import { Button } from "@/components/ui/button";

export type StudentIntegrityGroup = {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  batchName?: string | null;
  signals: ReviewQueueItem[];
};

interface StudentIntegrityCardProps {
  group: StudentIntegrityGroup;
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
      return "Large Code Paste";
    case "faster_than_rhythm":
      return "Typing Velocity Burst";
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

export function StudentIntegrityCard({
  group,
  onSelectSignalForVerdict,
}: StudentIntegrityCardProps) {
  const [activeTab, setActiveTab] = useState<"all" | "paste" | "burst" | "no_fix" | "pending">("all");

  const pasteSignals = useMemo(
    () => group.signals.filter((s) => s.type === "large_paste"),
    [group.signals]
  );

  const burstSignals = useMemo(
    () => group.signals.filter((s) => s.type === "faster_than_rhythm"),
    [group.signals]
  );

  const noFixSignals = useMemo(
    () => group.signals.filter((s) => s.type === "no_write_run_fix"),
    [group.signals]
  );

  const pendingSignals = useMemo(
    () => group.signals.filter((s) => s.reviewStatus === "pending"),
    [group.signals]
  );

  const activeSignals = useMemo(() => {
    switch (activeTab) {
      case "paste":
        return pasteSignals;
      case "burst":
        return burstSignals;
      case "no_fix":
        return noFixSignals;
      case "pending":
        return pendingSignals;
      default:
        return group.signals;
    }
  }, [activeTab, pasteSignals, burstSignals, noFixSignals, pendingSignals, group.signals]);

  // Determine overall risk profile
  const riskProfile = useMemo(() => {
    const highCount = group.signals.filter((s) => s.strength === "high" || s.confidence >= 0.85).length;
    const totalCount = group.signals.length;

    if (highCount >= 2 || totalCount >= 4) {
      return {
        label: "High Risk Profile",
        badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
        icon: Flame,
      };
    }
    if (highCount >= 1 || totalCount >= 2) {
      return {
        label: "Moderate Attention",
        badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        icon: AlertTriangle,
      };
    }
    return {
      label: "Low Anomaly Volume",
      badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      icon: Info,
    };
  }, [group.signals]);

  const initials = group.studentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const RiskIcon = riskProfile.icon;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-border hover:shadow-sm space-y-4">
      {/* STUDENT INTEGRITY HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white font-bold text-sm shadow-xs">
            {initials}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">{group.studentName}</h3>
              {group.batchName ? (
                <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {group.batchName}
                </span>
              ) : null}
            </div>
            {group.studentEmail ? (
              <p className="text-xs text-muted-foreground font-mono">{group.studentEmail}</p>
            ) : null}
          </div>
        </div>

        {/* RISK BADGE & STATUS PILLS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className={`rounded-lg border px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold ${riskProfile.badgeClass}`}>
            <RiskIcon className="size-3.5" />
            <span>{riskProfile.label}</span>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-center shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Flags</p>
            <p className="text-sm font-bold text-foreground font-mono">{group.signals.length}</p>
          </div>

          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-center shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Pending</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
              {pendingSignals.length}
            </p>
          </div>
        </div>
      </div>

      {/* TABS BASED ON ANOMALY CATEGORY & TRIAGE STATUS */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>All Signals</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
            {group.signals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("paste")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === "paste"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Code Pastes</span>
          <span className="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {pasteSignals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("burst")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === "burst"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Typing Bursts</span>
          <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {burstSignals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("no_fix")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === "no_fix"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>No Write-Run-Fix</span>
          <span className="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {noFixSignals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ml-auto ${
            activeTab === "pending"
              ? "border-rose-500 text-rose-600 dark:text-rose-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Pending Triage</span>
          <span className="rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {pendingSignals.length}
          </span>
        </button>
      </div>

      {/* SIGNALS LIST UNDER ACTIVE TAB */}
      {activeSignals.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No integrity signals recorded under this category.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background/50 overflow-hidden text-xs">
          {activeSignals.map((signal) => {
            const isHigh = signal.strength === "high";

            let statusBadge = "bg-muted text-muted-foreground border-border/60";
            if (signal.reviewStatus === "needs_viva") {
              statusBadge = "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
            } else if (signal.reviewStatus === "dismissed") {
              statusBadge = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
            } else if (signal.reviewStatus === "escalated") {
              statusBadge = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
            } else {
              statusBadge = "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20";
            }

            return (
              <li
                key={signal.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors"
              >
                {/* SIGNAL DETAILS & HEURISTICS */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {signalTypeLabel(signal.type)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase ${
                        isHigh
                          ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                          : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {signal.strength} severity
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider border ${statusBadge}`}
                    >
                      {signal.reviewStatus.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      · Flagged at {formatReplayTime(signal.tStart)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-1">
                    Challenge: <span className="text-foreground font-medium">{signal.questionStatement}</span>
                  </p>

                  <p className="text-xs text-foreground/90 leading-relaxed pt-0.5">
                    {signal.explanation}
                  </p>
                </div>

                {/* DIRECT ACTIONS */}
                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectSignalForVerdict(signal)}
                    className="h-8 gap-1.5 text-xs border-primary/40 bg-background hover:bg-primary/10"
                  >
                    <Gavel className="size-3.5 text-primary" />
                    <span>Triage Verdict ⚖️</span>
                  </Button>

                  <Button asChild size="sm" className="h-8 gap-1.5 text-xs shadow-xs">
                    <Link href={`/replay/${signal.sessionId}?t=${Math.round(signal.tStart * 1000)}`}>
                      <Play className="size-3.5 fill-current" />
                      <span>Play Replay &rarr;</span>
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
