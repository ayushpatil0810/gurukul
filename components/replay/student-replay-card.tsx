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
  History,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import type { ReplaySessionSummary } from "@/lib/services/replay";
import { Button } from "@/components/ui/button";

export type StudentReplayGroup = {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  batchName?: string | null;
  sessions: ReplaySessionSummary[];
};

interface StudentReplayCardProps {
  group: StudentReplayGroup;
  onSelectSessionForIntegrity: (session: ReplaySessionSummary) => void;
}

function formatSessionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export function StudentReplayCard({
  group,
  onSelectSessionForIntegrity,
}: StudentReplayCardProps) {
  const [activeTab, setActiveTab] = useState<"all" | "graded" | "practice">("all");

  const gradedSessions = useMemo(
    () => group.sessions.filter((s) => s.mode === "graded"),
    [group.sessions]
  );

  const practiceSessions = useMemo(
    () => group.sessions.filter((s) => s.mode === "practice"),
    [group.sessions]
  );

  const activeSessions = useMemo(() => {
    if (activeTab === "graded") return gradedSessions;
    if (activeTab === "practice") return practiceSessions;
    return group.sessions;
  }, [activeTab, gradedSessions, practiceSessions, group.sessions]);

  // Aggregate student metrics
  const totalFlags = useMemo(
    () => group.sessions.reduce((acc, s) => acc + (s.signalsCount ?? 0), 0),
    [group.sessions]
  );

  const gradedPassAverage = useMemo(() => {
    const scores = gradedSessions
      .map((s) => s.passRate)
      .filter((rate): rate is number => typeof rate === "number");
    if (scores.length === 0) return null;
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round((sum / scores.length) * 100);
  }, [gradedSessions]);

  const initials = group.studentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-border hover:shadow-sm space-y-4">
      {/* STUDENT PROFILE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-bold text-sm shadow-xs">
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

        {/* SUMMARY KPI CHIPS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-center shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sessions</p>
            <p className="text-sm font-bold text-foreground font-mono">{group.sessions.length}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-center shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">OA Pass Rate</p>
            <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {gradedPassAverage !== null ? `${gradedPassAverage}%` : "N/A"}
            </p>
          </div>

          <div
            className={`rounded-lg border px-3 py-1.5 text-center shadow-2xs ${
              totalFlags > 0
                ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider">Integrity</p>
            <p className="text-sm font-bold font-mono flex items-center justify-center gap-1">
              {totalFlags > 0 ? (
                <>
                  <ShieldAlert className="size-3.5" />
                  {totalFlags} Flags
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5" />
                  Clean
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* TABS BASED ON TYPES OF TESTS ATTEMPTED */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>All Recorded Tests</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
            {group.sessions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("graded")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "graded"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Online Assessments (OA)</span>
          <span className="rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {gradedSessions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("practice")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "practice"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Practice Challenges</span>
          <span className="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {practiceSessions.length}
          </span>
        </button>
      </div>

      {/* SESSIONS UNDER ACTIVE TAB */}
      {activeSessions.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No tests attempted under this category.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background/50 overflow-hidden text-xs">
          {activeSessions.map((session) => {
            const hasFlags = (session.signalsCount ?? 0) > 0;
            const isGraded = session.mode === "graded";
            const dateStr = new Date(session.startedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <li
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors"
              >
                {/* QUESTION STATEMENT & METADATA */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider ${
                        isGraded
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                          : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                      }`}
                    >
                      {isGraded ? "Graded Exam (OA)" : "Practice Lab"}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">{dateStr}</span>
                    {session.durationSeconds ? (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        · {formatSessionTime(session.durationSeconds)}
                      </span>
                    ) : null}
                  </div>

                  <p className="font-semibold text-foreground text-sm line-clamp-1">
                    {session.questionStatement}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono pt-0.5">
                    {typeof session.passRate === "number" ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {session.passedCount !== null && session.totalTests !== null
                          ? `${session.passedCount}/${session.totalTests} Tests Passed`
                          : `${Math.round(session.passRate * 100)}% Pass Rate`}
                      </span>
                    ) : (
                      <span>Ungraded / In Progress</span>
                    )}

                    <span>{session.eventCount ?? 0} events recorded</span>

                    {/* INTEGRITY STATUS CHIP */}
                    {hasFlags ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 border border-rose-500/20 font-sans">
                        <AlertTriangle className="size-3" />
                        {session.signalsCount} Anomaly ({session.latestSignalType?.replace(/_/g, " ")})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-sans">
                        <ShieldCheck className="size-3" />
                        Clean Telemetry
                      </span>
                    )}
                  </div>
                </div>

                {/* DIRECT ACTIONS */}
                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectSessionForIntegrity(session)}
                    className={`h-8 gap-1.5 text-xs ${
                      hasFlags
                        ? "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Shield className="size-3.5" />
                    <span>Integrity Review</span>
                  </Button>

                  <Button asChild size="sm" className="h-8 gap-1.5 text-xs shadow-xs">
                    <Link href={`/replay/${session.id}`}>
                      <Play className="size-3.5 fill-current" />
                      <span>Watch Replay &rarr;</span>
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
