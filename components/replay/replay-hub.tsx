"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  Filter,
  History,
  Layers,
  MapPin,
  Play,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { ReplaySessionSummary } from "@/lib/services/replay";
import { RecentSessionsMap } from "./recent-sessions-map";
import { StudentReplayCard, type StudentReplayGroup } from "./student-replay-card";
import { SessionIntegrityDrawer } from "./session-integrity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReplayHubProps {
  sessions: ReplaySessionSummary[];
}

export function ReplayHub({ sessions }: ReplayHubProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(false);
  const [activeSessionForIntegrity, setActiveSessionForIntegrity] = useState<ReplaySessionSummary | null>(null);
  const [isIntegrityDrawerOpen, setIsIntegrityDrawerOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(true);

  // Extract unique batches
  const batches = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.batchName) set.add(s.batchName);
    }
    return Array.from(set);
  }, [sessions]);

  // Aggregate KPI metrics
  const kpis = useMemo(() => {
    const totalSessions = sessions.length;
    const uniqueStudents = new Set(sessions.map((s) => s.studentId)).size;
    const totalSignals = sessions.reduce((acc, s) => acc + (s.signalsCount ?? 0), 0);
    const gradedSessions = sessions.filter((s) => s.mode === "graded");
    const scores = gradedSessions
      .map((s) => s.passRate)
      .filter((r): r is number => typeof r === "number");
    const avgGradedPass =
      scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null;

    return {
      totalSessions,
      uniqueStudents,
      totalSignals,
      avgGradedPass,
    };
  }, [sessions]);

  // Group sessions by student
  const studentGroups = useMemo(() => {
    const map = new Map<string, StudentReplayGroup>();
    for (const session of sessions) {
      const existing = map.get(session.studentId);
      if (!existing) {
        map.set(session.studentId, {
          studentId: session.studentId,
          studentName: session.studentName,
          studentEmail: session.studentEmail,
          batchName: session.batchName,
          sessions: [session],
        });
      } else {
        existing.sessions.push(session);
      }
    }
    return Array.from(map.values());
  }, [sessions]);

  // Filter student groups
  const filteredStudentGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return studentGroups.filter((group) => {
      // Search filter
      const matchesSearch =
        !q ||
        group.studentName.toLowerCase().includes(q) ||
        (group.studentEmail && group.studentEmail.toLowerCase().includes(q)) ||
        group.sessions.some((s) => s.questionStatement.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Batch filter
      if (selectedBatch !== "all" && group.batchName !== selectedBatch) {
        return false;
      }

      // Flagged only filter
      if (flaggedOnly) {
        const hasFlag = group.sessions.some((s) => (s.signalsCount ?? 0) > 0);
        if (!hasFlag) return false;
      }

      return true;
    });
  }, [studentGroups, searchQuery, selectedBatch, flaggedOnly]);

  const handleOpenIntegrityDrawer = (session: ReplaySessionSummary) => {
    setActiveSessionForIntegrity(session);
    setIsIntegrityDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">
              Integrity Diagnostics
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs text-muted-foreground">Student Replay Hub</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Session Replay & Telemetry
          </h1>
          <p className="text-xs text-muted-foreground">
            Audit student keystrokes, monitor code construction sequences, and investigate behavioral integrity signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="gap-1.5 text-xs font-medium"
          >
            <Compass className="size-3.5" />
            {isMapExpanded ? "Hide Sessions Map" : "Show Recent Sessions Map"}
          </Button>

          <Button asChild size="sm" variant="secondary" className="gap-1.5 text-xs font-medium">
            <Link href="/review">
              <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>Integrity Review Queue</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Sessions</span>
            <History className="size-4 text-primary" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {kpis.totalSessions}
          </p>
          <p className="text-[11px] text-muted-foreground">Recorded student sessions</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Students</span>
            <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {kpis.uniqueStudents}
          </p>
          <p className="text-[11px] text-muted-foreground">Enrolled cohort members</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Integrity Signals</span>
            <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
            {kpis.totalSignals}
          </p>
          <p className="text-[11px] text-muted-foreground">Behavioral anomalies flagged</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">OA Pass Average</span>
            <Award className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {kpis.avgGradedPass !== null ? `${kpis.avgGradedPass}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Graded assessment success</p>
        </div>
      </div>

      {/* RECENT SESSIONS MAP */}
      {isMapExpanded ? (
        <RecentSessionsMap
          sessions={sessions}
          onSelectSessionForIntegrity={handleOpenIntegrityDrawer}
        />
      ) : null}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-xs space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by student name, email, or question keyword…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>

          {/* FILTER CONTROLS */}
          <div className="flex flex-wrap items-center gap-2">
            {/* BATCH SELECTOR */}
            {batches.length > 0 ? (
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-2xs"
              >
                <option value="all">All Cohort Batches</option>
                {batches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            ) : null}

            {/* FLAGGED TOGGLE CHIP */}
            <button
              onClick={() => setFlaggedOnly(!flaggedOnly)}
              className={`inline-flex items-center gap-1.5 h-9 rounded-md border px-3 text-xs font-semibold transition-colors ${
                flaggedOnly
                  ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="size-3.5" />
              <span>Flagged for Review Only</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2 font-mono">
          <span>
            Showing <strong className="text-foreground">{filteredStudentGroups.length}</strong> of{" "}
            <strong>{studentGroups.length}</strong> students
          </span>
          {flaggedOnly ? (
            <span className="text-rose-600 dark:text-rose-400 font-semibold font-sans">
              Filtered: Showing only students with integrity alerts
            </span>
          ) : null}
        </div>
      </div>

      {/* STUDENT CARDS LIST */}
      {filteredStudentGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <History className="mx-auto size-8 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">No Student Sessions Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No student recordings match your search criteria. Try clearing filters or searching for another student.
          </p>
          {(searchQuery || selectedBatch !== "all" || flaggedOnly) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedBatch("all");
                setFlaggedOnly(false);
              }}
              className="text-xs mt-2"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredStudentGroups.map((group) => (
            <StudentReplayCard
              key={group.studentId}
              group={group}
              onSelectSessionForIntegrity={handleOpenIntegrityDrawer}
            />
          ))}
        </div>
      )}

      {/* SESSION INTEGRITY SLIDE-OVER DRAWER */}
      <SessionIntegrityDrawer
        session={activeSessionForIntegrity}
        isOpen={isIntegrityDrawerOpen}
        onClose={() => {
          setIsIntegrityDrawerOpen(false);
          setActiveSessionForIntegrity(null);
        }}
      />
    </div>
  );
}
