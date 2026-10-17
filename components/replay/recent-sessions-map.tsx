"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Filter,
  Flame,
  History,
  Layers,
  MapPin,
  Play,
  Shield,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ReplaySessionSummary } from "@/lib/services/replay";
import { Button } from "@/components/ui/button";

interface RecentSessionsMapProps {
  sessions: ReplaySessionSummary[];
  onSelectSessionForIntegrity: (session: ReplaySessionSummary) => void;
}

function formatSessionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export function RecentSessionsMap({
  sessions,
  onSelectSessionForIntegrity,
}: RecentSessionsMapProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");

  const filteredSessions = useMemo(() => {
    const now = new Date().getTime();
    if (timeFilter === "today") {
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      return sessions.filter((s) => new Date(s.startedAt).getTime() >= oneDayAgo);
    }
    if (timeFilter === "week") {
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      return sessions.filter((s) => new Date(s.startedAt).getTime() >= oneWeekAgo);
    }
    return sessions;
  }, [sessions, timeFilter]);

  // Group by date bucket for chronological visual flow
  const groupedByDate = useMemo(() => {
    const groups: { [dateStr: string]: ReplaySessionSummary[] } = {};
    for (const session of filteredSessions) {
      const date = new Date(session.startedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(session);
    }
    return groups;
  }, [filteredSessions]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs space-y-5">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Compass className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-foreground">Recent Sessions Map</h2>
            <span className="rounded-md border border-border/80 bg-background/50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Cohort Timeline
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Topological activity flow of student coding recordings, completion scores, and integrity signals.
          </p>
        </div>

        {/* TIME FILTER PILLS & LEGEND */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/70 bg-background p-0.5 text-xs">
            <button
              onClick={() => setTimeFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                timeFilter === "all" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeFilter("week")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                timeFilter === "week" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Past 7 Days
            </button>
            <button
              onClick={() => setTimeFilter("today")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                timeFilter === "today" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* LEGEND BAR */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground bg-muted/20 px-3.5 py-2 rounded-xl border border-border/50">
        <span className="font-semibold text-foreground text-xs">Map Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span>Passed Clean (0 Flags)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500 shadow-xs" />
          <span>Partial / In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-500 animate-pulse shadow-xs" />
          <span>Integrity Anomaly Flagged</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="rounded bg-purple-500/10 px-1.5 py-0.5 font-mono text-[10px] text-purple-700 dark:text-purple-300 font-bold border border-purple-500/20">
            OA
          </span>
          <span>Online Assessment</span>
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:text-blue-300 font-bold border border-blue-500/20 ml-2">
            PRACTICE
          </span>
          <span>Practice Lab</span>
        </div>
      </div>

      {/* SESSIONS TIMELINE FLOW GRID */}
      {Object.keys(groupedByDate).length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No learning sessions match the selected timeframe.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByDate).map(([dateStr, daySessions]) => (
            <div key={dateStr} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground font-mono">{dateStr}</span>
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] text-muted-foreground">{daySessions.length} sessions</span>
              </div>

              {/* INTERACTIVE SESSION NODE GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {daySessions.map((session) => {
                  const isSelected = selectedSessionId === session.id;
                  const hasFlags = (session.signalsCount ?? 0) > 0;
                  const isPassed = session.passRate === 1;
                  const isGraded = session.mode === "graded";

                  let nodeBorder = "border-border/60 hover:border-border";
                  let statusBg = "bg-emerald-500";
                  if (hasFlags) {
                    nodeBorder = "border-rose-500/40 bg-rose-500/5 hover:border-rose-500";
                    statusBg = "bg-rose-500";
                  } else if (!isPassed && session.passRate !== null) {
                    nodeBorder = "border-amber-500/40 bg-amber-500/5 hover:border-amber-500";
                    statusBg = "bg-amber-500";
                  }

                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSessionId(isSelected ? null : session.id)}
                      className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-3 shadow-2xs transition-all hover:shadow-xs ${nodeBorder} ${
                        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "bg-card/90"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`size-2 shrink-0 rounded-full ${statusBg}`} />
                            <span className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                              {session.studentName}
                            </span>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase ${
                              isGraded
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                            }`}
                          >
                            {isGraded ? "OA" : "LAB"}
                          </span>
                        </div>

                        <p className="line-clamp-1 text-[11px] text-muted-foreground font-sans">
                          {session.questionStatement}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground font-mono">
                        <span>
                          {new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {hasFlags ? (
                          <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="size-3" />
                            {session.signalsCount} Flag
                          </span>
                        ) : typeof session.passRate === "number" ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {Math.round(session.passRate * 100)}% Pass
                          </span>
                        ) : (
                          <span>In progress</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SELECTED SESSION QUICK PREVIEW BAR */}
      {selectedSession ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-xs space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{selectedSession.studentName}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground font-mono">{selectedSession.studentEmail}</span>
                {selectedSession.batchName ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {selectedSession.batchName}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-foreground line-clamp-1">
                Challenge: <span className="font-medium text-foreground">{selectedSession.questionStatement}</span>
              </p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono pt-0.5">
                <span>Mode: {selectedSession.mode}</span>
                {selectedSession.durationSeconds ? (
                  <span>Duration: {formatSessionTime(selectedSession.durationSeconds)}</span>
                ) : null}
                <span>Events: {selectedSession.eventCount ?? 0}</span>
                {typeof selectedSession.passRate === "number" ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Pass: {Math.round(selectedSession.passRate * 100)}%
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectSessionForIntegrity(selectedSession)}
                className="h-8 gap-1.5 text-xs border-primary/30 bg-background hover:bg-primary/10"
              >
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>Integrity Review</span>
                {(selectedSession.signalsCount ?? 0) > 0 ? (
                  <span className="rounded-full bg-rose-500 text-white px-1.5 text-[10px] font-bold">
                    {selectedSession.signalsCount}
                  </span>
                ) : null}
              </Button>

              <Button asChild size="sm" className="h-8 gap-1.5 text-xs shadow-xs">
                <Link href={`/replay/${selectedSession.id}`}>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Watch Replay &rarr;
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
