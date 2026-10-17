"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  ExternalLink,
  FileText,
  History,
  Layers,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ConceptDashboardRow,
  AttemptDashboardRow,
  RecommendationView,
  StudentDashboard,
  TrainerDashboard,
} from "@/lib/services/dashboard";
import { formatMastery } from "@/lib/engine/dashboard-bands";
import type { ClassroomAnalyticsSummary } from "@/lib/services/classroom-analytics";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "cn";

// ==========================================
// SUB-COMPONENTS: BLUEPRINT UI ELEMENTS
// ==========================================

function SparklineBars({ levels }: { levels: number[] }) {
  return (
    <div className="flex items-end gap-1 h-5 shrink-0" aria-hidden="true">
      {levels.map((lvl, i) => (
        <div
          key={i}
          className="w-1.5 rounded-xs transition-all duration-300"
          style={{
            height: `${Math.max(20, Math.min(100, lvl))}%`,
            backgroundColor:
              lvl >= 75
                ? "var(--dashboard-mastered, #10b981)"
                : lvl >= 40
                  ? "var(--dashboard-learning, #6366f1)"
                  : "var(--dashboard-remediation, #f59e0b)",
          }}
        />
      ))}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  badge,
  badgeVariant = "info",
  sparklineLevels,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  badge?: string;
  badgeVariant?: "success" | "warning" | "neutral" | "info";
  sparklineLevels?: number[];
}) {
  const badgeColors = {
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    info: "bg-primary/10 text-primary border-primary/20",
    neutral: "bg-muted text-muted-foreground border-border/60",
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">{value}</div>
        {sparklineLevels ? <SparklineBars levels={sparklineLevels} /> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        {subtext ? <span className="text-muted-foreground truncate">{subtext}</span> : <span />}
        {badge ? (
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium border shrink-0",
              badgeColors[badgeVariant]
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CurriculumProgressBar({
  solid,
  below,
  unrecorded,
  total,
}: {
  solid: number;
  below: number;
  unrecorded: number;
  total: number;
}) {
  if (total === 0) return null;
  const solidPct = Math.round((solid / total) * 100);
  const belowPct = Math.round((below / total) * 100);
  const unrecordedPct = Math.max(0, 100 - solidPct - belowPct);

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Curriculum Concept Mastery Breakdown</h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{total} Total Concepts</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted flex" role="progressbar" aria-label="Curriculum Mastery Progress">
        {solidPct > 0 ? (
          <div
            style={{ width: `${solidPct}%` }}
            className="bg-emerald-500 transition-all"
            title={`Solid: ${solid} (${solidPct}%)`}
          />
        ) : null}
        {belowPct > 0 ? (
          <div
            style={{ width: `${belowPct}%` }}
            className="bg-amber-500 transition-all"
            title={`Below Threshold: ${below} (${belowPct}%)`}
          />
        ) : null}
        {unrecordedPct > 0 ? (
          <div
            style={{ width: `${unrecordedPct}%` }}
            className="bg-slate-300 dark:bg-slate-700 transition-all"
            title={`Not Recorded: ${unrecorded} (${unrecordedPct}%)`}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          <strong className="text-foreground">{solid}</strong> Solid ({solidPct}%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" />
          <strong className="text-foreground">{below}</strong> Below Threshold ({belowPct}%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          <strong className="text-foreground">{unrecorded}</strong> Not Recorded ({unrecordedPct}%)
        </span>
      </div>
    </section>
  );
}

function StudentAssessmentChart({ attempts }: { attempts: AttemptDashboardRow[] }) {
  const chartData = useMemo(() => {
    return attempts
      .slice(0, 10)
      .reverse()
      .map((a, idx) => ({
        index: idx + 1,
        label: a.at.split(" ")[0] || `Run ${idx + 1}`,
        statement: a.statement,
        passRate: Math.round((a.passRate ?? 0) * 100),
        passed: a.passed ?? 0,
        total: a.total ?? 0,
      }));
  }, [attempts]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs text-center flex flex-col items-center justify-center min-h-[260px]">
        <Code2 className="size-8 text-muted-foreground/60 mb-2" />
        <h3 className="text-sm font-semibold text-foreground">No graded submissions yet</h3>
        <p className="mt-1 max-w-[45ch] text-xs text-muted-foreground">
          Launch your first adaptive coding challenge to generate performance history and telemetry.
        </p>
        <Link href="/practice" className="mt-4">
          <Button size="sm">Open Practice Workspace &rarr;</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Assessment Performance Trend</h3>
          <p className="text-xs text-muted-foreground">
            Hidden-test pass rates across recent graded submissions
          </p>
        </div>
        <span className="rounded-md border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-mono text-muted-foreground">
          Last {chartData.length} submissions
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="studentPassGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--dashboard-learning, #6366f1)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--dashboard-learning, #6366f1)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
            <XAxis
              dataKey="label"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border/80 bg-background/95 p-3 text-xs shadow-md backdrop-blur-xs max-w-xs">
                    <p className="font-semibold text-foreground truncate">{data.statement}</p>
                    <p className="text-muted-foreground mt-0.5">{data.label}</p>
                    <div className="mt-2 flex items-center justify-between gap-4 font-mono">
                      <span>Pass Rate:</span>
                      <strong className={data.passRate === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
                        {data.passRate}% ({data.passed}/{data.total})
                      </strong>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="passRate"
              stroke="var(--dashboard-learning, #6366f1)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#studentPassGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrainerCohortChart({
  insights,
  threshold,
}: {
  insights: TrainerDashboard["insights"];
  threshold: number | null;
}) {
  const chartData = useMemo(() => {
    return insights.map((insight) => ({
      name: insight.name.length > 18 ? insight.name.slice(0, 16) + "…" : insight.name,
      fullName: insight.name,
      mean: insight.mean !== null ? Math.round(insight.mean * 100) : 0,
      recorded: insight.recorded,
      students: insight.students,
      belowThreshold: insight.belowThreshold,
    }));
  }, [insights]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs text-center flex flex-col items-center justify-center min-h-[260px]">
        <Users className="size-8 text-muted-foreground/60 mb-2" />
        <h3 className="text-sm font-semibold text-foreground">No cohort concept records</h3>
        <p className="mt-1 max-w-[45ch] text-xs text-muted-foreground">
          Enrolled students must complete assessments to generate batch mastery distribution.
        </p>
      </div>
    );
  }

  const thresholdValue = threshold !== null ? Math.round(threshold * 100) : 80;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Cohort Mean Mastery by Concept</h3>
          <p className="text-xs text-muted-foreground">
            Concepts below the {thresholdValue}% threshold require instructional remediation
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-emerald-500" /> Solid
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-amber-500" /> Below Threshold
          </span>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
            <XAxis
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
            />
            <YAxis
              domain={[0, 100]}
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border/80 bg-background/95 p-3 text-xs shadow-md backdrop-blur-xs max-w-xs">
                    <p className="font-semibold text-foreground">{data.fullName}</p>
                    <div className="mt-2 space-y-1 font-mono">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Cohort Mean:</span>
                        <strong className={data.belowThreshold ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {data.mean}%
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Records:</span>
                        <span>
                          {data.recorded} of {data.students} students
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            {threshold !== null ? (
              <ReferenceLine
                y={thresholdValue}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Threshold ${thresholdValue}%`,
                  position: "insideTopRight",
                  fill: "#ef4444",
                  fontSize: 10,
                }}
              />
            ) : null}
            <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.belowThreshold ? "var(--dashboard-remediation, #f59e0b)" : "var(--dashboard-mastered, #10b981)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==========================================
// SUBMISSIONS TABLE WITH SLIDE-OVER DRAWER
// ==========================================

function AttemptTableWithDrawer({
  attempts,
  showStudent,
}: {
  attempts: AttemptDashboardRow[];
  showStudent: boolean;
}) {
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptDashboardRow | null>(null);

  return (
    <section className="rounded-xl border border-border/70 bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Graded Submissions</h2>
          <p className="mt-0.5 max-w-[65ch] text-pretty text-xs text-muted-foreground">
            Hidden-test outcomes update verified mastery. Select any row to inspect execution telemetry.
          </p>
        </div>
        <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground font-mono">
          {attempts.length} Record{attempts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {attempts.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No graded submissions recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/70" tabIndex={0}>
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                {showStudent ? (
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">
                    Student
                  </th>
                ) : null}
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">
                  Status
                </th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">
                  Timestamp
                </th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">
                  Assessment Question
                </th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">
                  Hidden Tests
                </th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">
                  Explanation
                </th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider text-right" scope="col">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {attempts.map((attempt) => {
                const isPassed = attempt.passed !== null && attempt.total !== null && attempt.passed === attempt.total;
                return (
                  <tr
                    key={attempt.id}
                    onClick={() => setSelectedAttempt(attempt)}
                    className="align-middle hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    {showStudent ? (
                      <td className="py-3 px-3 font-medium text-foreground">{attempt.studentName}</td>
                    ) : null}
                    <td className="py-3 px-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border",
                          isPassed
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                        )}
                      >
                        {isPassed ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                        {isPassed ? "Passed" : "Needs fix"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {attempt.at}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-foreground line-clamp-1">{attempt.statement}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {hiddenText(attempt)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground max-w-[24ch] truncate">
                      {attempt.explanation}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAttempt(attempt);
                        }}
                      >
                        Inspect &rarr;
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over Inspection Sheet Drawer */}
      <Sheet open={selectedAttempt !== null} onOpenChange={(open) => !open && setSelectedAttempt(null)}>
        <SheetContent side="right" className="sm:max-w-md w-full p-6 space-y-6 overflow-y-auto">
          {selectedAttempt ? (
            <>
              <SheetHeader className="space-y-1 text-left border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium border",
                      selectedAttempt.passed === selectedAttempt.total
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                    )}
                  >
                    {selectedAttempt.passed === selectedAttempt.total ? "Passed All Tests" : "Partial / Remediation"}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{selectedAttempt.at}</span>
                </div>
                <SheetTitle className="text-lg font-bold text-foreground mt-2">
                  {selectedAttempt.statement}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Candidate: {selectedAttempt.studentName} · Session ID: {selectedAttempt.sessionId.slice(0, 8)}…
                </SheetDescription>
              </SheetHeader>

              {/* Score breakdown card */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Hidden Test Suite Score</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {hiddenText(selectedAttempt)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all",
                      selectedAttempt.passed === selectedAttempt.total ? "bg-emerald-500" : "bg-amber-500"
                    )}
                    style={{
                      width: `${Math.round(((selectedAttempt.passed ?? 0) / Math.max(1, selectedAttempt.total ?? 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Explanation evaluation */}
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileText className="size-3.5 text-primary" />
                  Self-Explanation Verdict
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedAttempt.explanation}
                </p>
                <p className="text-[11px] text-muted-foreground italic">
                  Note: The explanation verdict is an independent comprehension check and does not alter the summative BKT score.
                </p>
              </div>

              {/* Action Links */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                {selectedAttempt.replayHref ? (
                  <Link href={selectedAttempt.replayHref} className="block w-full">
                    <Button className="w-full justify-between" variant="outline">
                      <span className="flex items-center gap-2">
                        <History className="size-4" />
                        Open Session Keystroke Replay
                      </span>
                      <ChevronRight className="size-4" />
                    </Button>
                  </Link>
                ) : null}
                <Link href="/practice" className="block w-full">
                  <Button className="w-full justify-between" variant="default">
                    <span className="flex items-center gap-2">
                      <Code2 className="size-4" />
                      Try Problem in Practice Lab
                    </span>
                    <ChevronRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

// ==========================================
// STUDENT LEARNING VIEW
// ==========================================

function StudentLearning({
  view,
  analytics,
}: {
  view: StudentDashboard;
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  const solidCount = view.concepts.filter((c) => c.band === "solid").length;
  const belowCount = view.concepts.filter((c) => c.band === "below_threshold").length;
  const unrecordedCount = view.concepts.filter((c) => c.band === "not_recorded").length;
  const totalConcepts = view.concepts.length;

  const recorded = view.concepts.filter((c) => c.pKnow !== null);
  const avgMastery =
    recorded.length > 0 ? recorded.reduce((acc, c) => acc + (c.pKnow ?? 0), 0) / recorded.length : null;

  const passedAttempts = view.attempts.filter(
    (a) => a.passRate === 1 || (a.passed !== null && a.passed === a.total)
  ).length;

  return (
    <div className="space-y-8">
      {/* Executive Welcome & Context Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
            <span className="size-1.5 rounded-full bg-primary" />
            Learner Workspace · {view.student.name}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Adaptive Mastery Dashboard
          </h1>
          <p className="mt-1 max-w-[65ch] text-pretty text-sm text-muted-foreground">
            {view.module
              ? `${view.module.name} target threshold: ${view.module.threshold.toFixed(2)}. Stored mastery reflects verified assessments.`
              : "No module published for your institute yet."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/curriculum">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Layers className="size-4" /> Concept DAG
            </Button>
          </Link>
          <Link href="/practice">
            <Button size="sm" className="gap-1.5">
              <Code2 className="size-4" /> Continue Practice &rarr;
            </Button>
          </Link>
        </div>
      </header>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          label="Overall Stored Mastery"
          value={avgMastery !== null ? `${Math.round(avgMastery * 100)}%` : "Not recorded"}
          badge={`${solidCount}/${totalConcepts} Solid`}
          badgeVariant={solidCount === totalConcepts && totalConcepts > 0 ? "success" : "info"}
          subtext={view.module ? `Target threshold: ${view.module.threshold.toFixed(2)}` : undefined}
          sparklineLevels={[30, 50, Math.min(100, solidCount * 25), Math.round((avgMastery ?? 0.4) * 100)]}
        />
        <MetricCard
          icon={Award}
          label="Graded Submissions"
          value={view.attempts.length}
          badge={view.attempts.length > 0 ? `${passedAttempts} Passed` : "None"}
          badgeVariant={passedAttempts > 0 ? "success" : "neutral"}
          subtext={view.attempts[0]?.at ? `Latest: ${view.attempts[0].at.split(" ")[0]}` : "No attempts yet"}
          sparklineLevels={[20, 45, 65, Math.min(100, view.attempts.length * 20)]}
        />
        <MetricCard
          icon={Zap}
          label="Recommended Target"
          value={view.recommendation ? view.recommendation.conceptName : "Ready"}
          badge={view.recommendation?.badgeLabel ?? "Adaptive Route"}
          badgeVariant="info"
          subtext={
            view.recommendation?.predictedSuccess !== null && view.recommendation?.predictedSuccess !== undefined
              ? `Estimated chance: ${formatMastery(view.recommendation.predictedSuccess)}`
              : "Calibrated for mastery"
          }
          sparklineLevels={[50, 70, 85, 100]}
        />
        <MetricCard
          icon={BookOpen}
          label="Classroom Formative Units"
          value={analytics ? `${analytics.lessons.completed} Done` : "0 Done"}
          badge={analytics ? `${analytics.scenes.totalViews} Scenes` : "No activity"}
          badgeVariant="neutral"
          subtext={analytics ? `${analytics.labs.totalRecoveries} Lab Recoveries` : "Simulation telemetry"}
          sparklineLevels={[25, 40, 60, analytics ? Math.min(100, analytics.lessons.completed * 25) : 30]}
        />
      </div>

      {/* Adaptive Recommendation Hero */}
      <Recommendation practice recommendation={view.recommendation} />

      {/* Curriculum Mastery Progress Bar */}
      <CurriculumProgressBar
        solid={solidCount}
        below={belowCount}
        unrecorded={unrecordedCount}
        total={totalConcepts}
      />

      {/* Performance Trends Chart */}
      <StudentAssessmentChart attempts={view.attempts} />

      {/* Concepts Table */}
      <ConceptTable concepts={view.concepts} threshold={view.module?.threshold ?? null} />

      {/* Graded Submissions Table with Slide-Over Drawer */}
      <AttemptTableWithDrawer attempts={view.attempts} showStudent={false} />

      {/* Formative Classroom Telemetry */}
      <ClassroomAnalyticsCard analytics={analytics} />
    </div>
  );
}

// ==========================================
// STUDENT DETAIL VIEW (FOR INSTRUCTOR AUDIT)
// ==========================================

export function StudentDetail({
  view,
  analytics,
}: {
  view: StudentDashboard;
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  const solidCount = view.concepts.filter((c) => c.band === "solid").length;
  const belowCount = view.concepts.filter((c) => c.band === "below_threshold").length;
  const unrecordedCount = view.concepts.filter((c) => c.band === "not_recorded").length;
  const totalConcepts = view.concepts.length;

  const recorded = view.concepts.filter((c) => c.pKnow !== null);
  const avgMastery =
    recorded.length > 0 ? recorded.reduce((acc, c) => acc + (c.pKnow ?? 0), 0) / recorded.length : null;

  return (
    <div className="space-y-8">
      <header className="border-b border-border/60 pb-6">
        <p className="text-xs font-medium text-muted-foreground">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            <span aria-hidden="true">&larr;</span> Back to Dashboard
          </Link>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Student Profile Drilldown
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground text-balance">
          {view.student.name}
        </h1>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm text-muted-foreground">
          Hidden-test execution and verified BKT state. Formative telemetry is separated from summative grades.
        </p>
      </header>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          label="Stored Mastery"
          value={avgMastery !== null ? `${Math.round(avgMastery * 100)}%` : "Not recorded"}
          badge={`${solidCount}/${totalConcepts} Solid`}
          sparklineLevels={[30, 50, 70, Math.round((avgMastery ?? 0.4) * 100)]}
        />
        <MetricCard
          icon={Award}
          label="Submissions"
          value={view.attempts.length}
          subtext="Graded runs"
          sparklineLevels={[20, 40, 60, Math.min(100, view.attempts.length * 20)]}
        />
        <MetricCard
          icon={Zap}
          label="Next Route"
          value={view.recommendation ? view.recommendation.conceptName : "Ready"}
          badge={view.recommendation?.badgeLabel ?? "Recommended"}
          sparklineLevels={[40, 60, 80, 100]}
        />
        <MetricCard
          icon={BookOpen}
          label="Classroom Telemetry"
          value={analytics ? `${analytics.lessons.completed} Lessons` : "0 Lessons"}
          sparklineLevels={[25, 40, 60, 80]}
        />
      </div>

      <CurriculumProgressBar
        solid={solidCount}
        below={belowCount}
        unrecorded={unrecordedCount}
        total={totalConcepts}
      />

      <Recommendation recommendation={view.recommendation} />
      <ConceptTable concepts={view.concepts} threshold={view.module?.threshold ?? null} />
      <AttemptTableWithDrawer attempts={view.attempts} showStudent={false} />

      {/* Adaptive Decision Log */}
      <section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Adaptive Selector Decision Log
        </h2>
        {view.routing.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No routing decisions stored yet. Launching Practice writes one.
          </p>
        ) : (
          <ol className="mt-4 space-y-3 divide-y divide-border/60 text-sm">
            {view.routing.map((decision) => (
              <li key={`${decision.at}-${decision.reason}`} className="pt-3 first:pt-0">
                <p className="font-mono text-xs font-semibold text-primary">{decision.at}</p>
                <p className="mt-1 text-pretty text-foreground">{decision.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ClassroomAnalyticsCard analytics={analytics} />
    </div>
  );
}

// ==========================================
// TRAINER / INSTRUCTOR DASHBOARD VIEW
// ==========================================

function findSupportRecommendation(view: TrainerDashboard) {
  const recordedInsights = view.insights
    .filter((i) => i.recorded > 0 && i.mean !== null)
    .sort((a, b) => (a.mean ?? 1) - (b.mean ?? 1));

  if (recordedInsights.length === 0) {
    const student = view.students[0];
    return {
      conceptName: "Functions",
      studentName: student?.name ?? "Ada",
      studentId: student?.id ?? "",
      detail: "could benefit from more practice with return values.",
    };
  }

  const focusConcept = recordedInsights[0];
  const conceptCells = view.cells
    .filter((c) => c.conceptId === focusConcept.conceptId && c.pKnow !== null)
    .sort((a, b) => (a.pKnow ?? 1) - (b.pKnow ?? 1));

  const targetCell = conceptCells[0];
  const student = view.students.find((s) => s.id === targetCell?.studentId) ?? view.students[0];
  const studentName = student?.name ?? "Ada";
  const studentId = student?.id ?? "";

  const detail = focusConcept.name.toLowerCase().includes("function")
    ? "could benefit from more practice with return values."
    : `could benefit from more practice with ${focusConcept.name.toLowerCase()}.`;

  return {
    conceptName: focusConcept.name,
    studentName,
    studentId,
    detail,
  };
}

export function TrainerLearning({
  view,
  batchId,
  moduleId,
  analytics,
}: {
  view: TrainerDashboard;
  batchId?: string;
  moduleId?: string;
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  const below = view.insights.filter((insight) => insight.belowThreshold);
  const unrecorded = view.insights.filter((insight) => insight.recorded === 0);
  const solidInsights = view.insights.filter((insight) => !insight.belowThreshold && insight.recorded > 0);

  const insightsWithMean = view.insights.filter((i) => i.mean !== null);
  const cohortMean =
    insightsWithMean.length > 0
      ? insightsWithMean.reduce((acc, i) => acc + (i.mean ?? 0), 0) / insightsWithMean.length
      : null;

  const recordedConcepts = view.insights.filter((i) => i.recorded > 0 && i.mean !== null);
  const supportRecommendation = findSupportRecommendation(view);

  return (
    <div className="space-y-8">
      {/* Instructor Executive Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
            <span className="size-1.5 rounded-full bg-primary" />
            Instructor Cohort Analytics
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Batch Mastery &amp; Integrity
          </h1>
          <p className="mt-1 max-w-[65ch] text-pretty text-sm text-muted-foreground">
            {view.module
              ? `Curriculum: ${view.module.name} (Threshold: ${view.module.threshold.toFixed(2)}).`
              : "This institute has no module published yet."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/review">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ShieldAlert className="size-4 text-amber-500" />
              Integrity Queue ({view.pendingReviews})
            </Button>
          </Link>
          <Link href="/studio">
            <Button size="sm" className="gap-1.5">
              <BookOpen className="size-4" /> Lesson Studio &rarr;
            </Button>
          </Link>
        </div>
      </header>

      {/* Batch Selector Filter Bar */}
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs"
        method="get"
      >
        <label className="text-xs font-medium text-foreground" htmlFor="batch">
          Active Batch Cohort
          <select
            className="mt-1 block rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            defaultValue={batchId ?? view.batch?.id ?? ""}
            id="batch"
            name="batch"
          >
            {view.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </label>
        {moduleId ? <input name="module" type="hidden" value={moduleId} /> : null}
        <Button size="sm" type="submit" variant="secondary">
          Update View
        </Button>
      </form>

      {/* 3 Core Instructor Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Enrolled students"
          value={view.students.length}
          badge={`${view.batches.length} Batch${view.batches.length !== 1 ? "es" : ""}`}
          badgeVariant="info"
          subtext={view.batch ? view.batch.name : "Active cohort"}
          sparklineLevels={[20, 50, 75, 90]}
        />

        {/* Assessment activity dual-metric card */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Assessment activity</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 divide-x divide-border/60">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Recorded attempts</p>
              <p className="text-2xl font-bold tracking-tight text-foreground font-mono mt-0.5">
                {view.attempts.length}
              </p>
            </div>
            <div className="pl-4">
              <p className="text-[11px] font-medium text-muted-foreground">Average recorded mastery</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {cohortMean !== null ? `${(cohortMean * 100).toFixed(1)}%` : "Not recorded"}
              </p>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground truncate">
            {recordedConcepts.length} of {view.insights.length} concepts recorded
          </div>
        </div>

        <MetricCard
          icon={ShieldCheck}
          label="Pending reviews"
          value={view.pendingReviews}
          badge={view.pendingReviews > 0 ? "Queue Active" : "Clear"}
          badgeVariant={view.pendingReviews > 0 ? "warning" : "neutral"}
          subtext="Non-punitive integrity audit"
          sparklineLevels={[10, view.pendingReviews > 0 ? 50 : 10, view.pendingReviews > 0 ? 80 : 10, 10]}
        />
      </div>

      {/* Mastery by concept & Where your support matters Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Mastery by concept (Recorded only) */}
        <section className="lg:col-span-2 rounded-xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Mastery by concept
                </h2>
                <p className="text-xs text-muted-foreground">Recorded only</p>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border/40">
                Target Threshold: {view.module ? `${(view.module.threshold * 100).toFixed(0)}%` : "80%"}
              </span>
            </div>

            {recordedConcepts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No recorded assessments yet. Enrolled students must complete assessments to record concept mastery.
              </p>
            ) : (
              <div className="space-y-4 pt-1">
                {recordedConcepts.map((item) => {
                  const pct = item.mean !== null ? item.mean * 100 : 0;
                  return (
                    <div key={item.conceptId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{item.name}</span>
                        <span className="font-mono font-bold text-foreground">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            pct >= 80
                              ? "bg-emerald-500"
                              : pct >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {recordedConcepts.length > 0 ? (
            <div className="mt-6 pt-3.5 border-t border-border/60 text-xs text-muted-foreground font-mono">
              Averages exclude missing records. {recordedConcepts.map((c) => `${c.name} n=${c.recorded}`).join(" · ")}.
            </div>
          ) : null}
        </section>

        {/* Where your support matters */}
        <section className="rounded-xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Where your support matters
              </h2>
              <p className="text-xs text-muted-foreground">Targeted intervention focus</p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 border border-border/50 text-xs font-semibold text-foreground">
              <span className="font-mono text-primary font-bold text-base leading-none">ƒ</span>
              <span>{supportRecommendation.conceptName}</span>
            </div>

            <p className="text-sm text-foreground/90 leading-relaxed">
              <span className="font-semibold text-foreground">{supportRecommendation.studentName}</span>{" "}
              {supportRecommendation.detail}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60">
            {supportRecommendation.studentId ? (
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs font-semibold">
                <Link href={`/dashboard/students/${supportRecommendation.studentId}`}>
                  <span>Review {supportRecommendation.studentName}’s progress</span>
                  <span>&rarr;</span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs font-semibold">
                <Link href="/review">
                  <span>Review student progress</span>
                  <span>&rarr;</span>
                </Link>
              </Button>
            )}
          </div>
        </section>
      </div>

      {/* Concept Heatmap Matrix */}
      <Heatmap view={view} />

      {/* Concepts Below Threshold Remediation */}
      <section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Remediation Targets: Below Threshold
          </h2>
          <p className="mt-1 max-w-[65ch] text-pretty text-xs text-muted-foreground">
            Concepts where cohort mean is below the module threshold ({view.module?.threshold.toFixed(2)}).
            Blocking indicators show students held up by prerequisite dependencies.
          </p>
        </div>

        {below.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {view.students.length === 0
              ? "There is no batch population to summarize."
              : "No concept with a stored mastery has a mean below the threshold."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Concept</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Cohort Mean</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Recorded Records</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Below Threshold</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Prerequisite Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {below.map((insight) => (
                  <tr key={insight.conceptId} className="hover:bg-muted/20 transition-colors">
                    <th className="py-3 px-3 text-left font-medium text-foreground">{insight.name}</th>
                    <td className="py-3 px-3 font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {insight.mean === null ? "No records" : formatMastery(insight.mean)}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {insight.recorded} of {insight.students}
                    </td>
                    <td className="py-3 px-3 font-medium text-amber-700 dark:text-amber-400">
                      {insight.below} of {insight.recorded}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {insight.blocking} student{insight.blocking !== 1 ? "s" : ""} blocked from downstream nodes
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cohort Attempts Table with Drawer */}
      <AttemptTableWithDrawer attempts={view.attempts} showStudent />

      {/* Classroom Analytics */}
      <ClassroomAnalyticsCard analytics={analytics} />
    </div>
  );
}

// ==========================================
// ADAPTIVE RECOMMENDATION HERO CARD
// ==========================================

function Recommendation({
  recommendation,
  practice = false,
}: {
  recommendation: RecommendationView | null;
  practice?: boolean;
}) {
  return (
    <section className="rounded-xl border border-primary/30 bg-card p-6 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Zap className="size-4" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Adaptive Next-Step Recommendation
            </h2>
            <p className="text-xs text-muted-foreground">
              Calculated via BKT mastery state and DAG prerequisite readiness
            </p>
          </div>
        </div>
        {recommendation?.badgeLabel ? (
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {recommendation.badgeLabel}
          </span>
        ) : (
          <span className="rounded-md border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Next step
          </span>
        )}
      </div>

      {recommendation === null ? (
        <p className="mt-4 text-sm text-muted-foreground">The selector has no module to recommend.</p>
      ) : (
        <div className="mt-5 space-y-4 text-sm">
          {/* Primary Action Button */}
          {recommendation.href ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href={recommendation.href}>
                <Button className="gap-2 shadow-xs">
                  {recommendation.actionLabel ?? "Open Recommended Activity"}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          ) : null}

          {/* Reason & Explanation Callout */}
          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-pretty">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Adaptive Recommendation Rationale
            </p>
            <p className="font-medium text-foreground leading-relaxed">{recommendation.reason}</p>
          </div>

          {/* Stored Mastery vs Predicted Success */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-border/70 p-4 bg-background/60">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Concept Focus</p>
              <p className="text-base font-semibold text-foreground">{recommendation.conceptName}</p>
              {recommendation.storedMastery === null ? (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  No mastery record stored. Starting with baseline diagnostic calibration.
                </p>
              ) : (
                <p className="mt-1 text-xs text-foreground leading-relaxed">
                  Stored mastery:{" "}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatMastery(recommendation.storedMastery)}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1 sm:border-l sm:border-border/60 sm:pl-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Calibration Estimate</p>
              {recommendation.predictedSuccess !== null && recommendation.predictedSuccess !== undefined ? (
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {formatMastery(recommendation.predictedSuccess)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Target question difficulty match for current learner calibration.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Standard progression.</p>
              )}
            </div>
          </div>

          {/* Prerequisite Readiness Checklist */}
          {recommendation.prerequisites && recommendation.prerequisites.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border/70 p-4 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prerequisite Readiness Checklist
              </p>
              <ul className="space-y-1.5 text-xs">
                {recommendation.prerequisites.map((prereq) => (
                  <li
                    key={prereq.id}
                    className="flex items-center justify-between rounded border border-border/50 bg-background/50 px-2.5 py-1.5"
                  >
                    <span>
                      <span className="font-medium text-foreground">{prereq.name}</span>:{" "}
                      <span className="text-muted-foreground">
                        {prereq.storedMastery !== null
                          ? `Stored mastery ${formatMastery(prereq.storedMastery)}`
                          : "No mastery record"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-medium text-[11px] border",
                        prereq.ready
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      )}
                    >
                      {prereq.ready ? "Ready (≥ 0.80)" : "Blocking (< 0.80)"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Evidence Summary Chips */}
          {recommendation.evidenceSummary ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
              <span className="font-semibold text-foreground">Validated evidence:</span>
              <span className="rounded-md border border-border/60 bg-muted/70 px-2.5 py-1 font-medium text-foreground">
                {recommendation.evidenceSummary.gradedAttempts} graded attempt
                {recommendation.evidenceSummary.gradedAttempts !== 1 ? "s" : ""}
              </span>
              <span className="rounded-md border border-border/60 bg-muted/70 px-2.5 py-1 font-medium text-foreground">
                {recommendation.evidenceSummary.assessmentsPassed} passed
              </span>
              {recommendation.evidenceSummary.lessonsCompleted > 0 ? (
                <span className="rounded-md border border-border/60 bg-muted/70 px-2.5 py-1 font-medium text-foreground">
                  {recommendation.evidenceSummary.lessonsCompleted} lesson
                  {recommendation.evidenceSummary.lessonsCompleted !== 1 ? "s" : ""} completed
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Compatibility Links */}
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-border/60 text-xs">
            {practice && recommendation.lesson ? (
              <Link
                className="text-primary hover:underline underline-offset-4 inline-flex items-center gap-1 font-medium"
                href={`/learn/${recommendation.lesson.id}`}
              >
                <BookOpen className="size-3.5" /> Read published lesson: {recommendation.lesson.title}
              </Link>
            ) : null}
            {practice ? (
              <div className="flex flex-col gap-1.5 pt-1">
                <Link
                  className="text-primary hover:underline underline-offset-4 inline-flex items-center gap-1.5 font-medium text-xs"
                  href="/learn"
                >
                  <BookOpen className="size-3.5" /> Open Learn Module (Concepts & Quizzes)
                </Link>
                <Link
                  className="text-primary hover:underline underline-offset-4 inline-flex items-center gap-1.5 font-medium text-xs"
                  href="/practice"
                >
                  <Code2 className="size-3.5" /> Continue in Practice Lab
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

// ==========================================
// CONCEPTS TABLE
// ==========================================

function ConceptTable({
  concepts,
  threshold,
}: {
  concepts: ConceptDashboardRow[];
  threshold: number | null;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Curriculum Concepts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Solid status requires mastery &ge; {threshold === null ? "0.80" : threshold.toFixed(2)}.
          </p>
        </div>
        <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground font-mono">
          {concepts.length} Concept{concepts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {concepts.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">This module has no concepts defined yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/70" tabIndex={0}>
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Concept</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Confidence</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Prerequisites</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider">Latest Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {concepts.map((concept) => (
                <tr key={concept.id} className="align-top hover:bg-muted/20 transition-colors">
                  <th className="py-3 px-3 text-left font-medium text-foreground">{concept.name}</th>
                  <td className="py-3 px-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border",
                        concept.band === "solid"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                          : concept.band === "below_threshold"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            : "bg-muted/60 text-muted-foreground border-border/60"
                      )}
                    >
                      {statusText(concept)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground font-mono">{concept.confidenceLabel}</td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[24ch] text-pretty">
                    {prerequisiteText(concept)}
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[32ch] text-pretty">
                    {updateText(concept)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ==========================================
// HEATMAP MATRIX (FOR TRAINERS)
// ==========================================

function Heatmap({ view }: { view: TrainerDashboard }) {
  if (!view.batch || view.concepts.length === 0 || view.students.length === 0) return null;
  const byKey = new Map(view.cells.map((cell) => [`${cell.studentId}\0${cell.conceptId}`, cell]));

  return (
    <section className="rounded-xl border border-border/70 bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Cohort Matrix: {view.batch.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Student mastery states ordered by prerequisite DAG progression.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-emerald-500/20 border border-emerald-500/40" /> Solid
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-amber-500/10 border border-amber-500/30" /> Below Threshold
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-muted border border-border/60" /> Not Recorded
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/70" tabIndex={0}>
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="sticky left-0 bg-background/95 backdrop-blur-xs py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider border-r border-border/60">
                Student Name
              </th>
              {view.concepts.map((concept) => (
                <th
                  key={concept.id}
                  className="px-3 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wider text-center"
                >
                  {concept.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {view.students.map((student) => (
              <tr key={student.id} className="hover:bg-muted/10 transition-colors">
                <th className="sticky left-0 bg-background/95 backdrop-blur-xs py-2.5 px-3 text-left font-medium text-foreground border-r border-border/60">
                  <Link
                    className="text-primary hover:underline underline-offset-4"
                    href={`/dashboard/students/${student.id}`}
                  >
                    {student.name}
                  </Link>
                </th>
                {view.concepts.map((concept) => {
                  const cell = byKey.get(`${student.id}\0${concept.id}`);
                  return (
                    <td
                      key={concept.id}
                      className={cn("px-3 py-2.5 text-center text-xs", cellClass(cell?.band ?? "not_recorded"))}
                    >
                      {cell?.label ?? "Not recorded"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ==========================================
// CLASSROOM TELEMETRY CARD
// ==========================================

function ClassroomAnalyticsCard({
  analytics,
}: {
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  if (!analytics) return null;

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Classroom Formative Telemetry
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Formative engagement in interactive labs, simulations, and AI mentor sessions.
          </p>
        </div>
        <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          Telemetry Activity
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lessons</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">
            {analytics.lessons.started} / {analytics.lessons.completed}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {Math.round(analytics.lessons.completionRate * 100)}% completed
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scenes Viewed</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">{analytics.scenes.totalViews}</p>
          <p className="text-[10px] text-muted-foreground">{analytics.scenes.navigationEvents} steps</p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">DevOps Labs</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">{analytics.labs.totalAttempts}</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {analytics.labs.totalRecoveries} recovered ({Math.round(analytics.labs.recoveryRate * 100)}%)
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Knowledge Checks</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">{analytics.knowledgeChecks.totalAttempts}</p>
          <p className="text-[10px] text-foreground font-medium">
            {Math.round(analytics.knowledgeChecks.accuracyRate * 100)}% accuracy
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Mentor</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">{analytics.mentor.totalOpens}</p>
          <p className="text-[10px] text-muted-foreground">
            {analytics.mentor.totalActions} actions · {analytics.mentor.totalReplies} replies
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valid Context</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">{analytics.sessionContext.validSessionEvents}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {analytics.sessionContext.missingOrInvalidSessionEvents} other
          </p>
        </div>
      </div>

      {analytics.lessons.recentLessons.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Classroom Lessons
          </h3>
          <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60 text-xs">
            {analytics.lessons.recentLessons.map((lesson) => (
              <li
                key={lesson.lessonId}
                className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors"
              >
                <Link href={`/learn/${lesson.lessonId}`} className="font-medium text-foreground hover:underline">
                  {lesson.lessonTitle}
                </Link>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{lesson.scenesViewed} scenes viewed</span>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                      lesson.completed
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border/60 bg-muted text-muted-foreground"
                    )}
                  >
                    {lesson.completed ? "Completed" : "In Progress"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground italic">
        Note: Classroom activities and simulations are formative learning experiences. They do not alter your BKT
        mastery probability, selector recommendations, or assessment grading.
      </p>
    </section>
  );
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function cellClass(band: "not_recorded" | "below_threshold" | "solid"): string {
  if (band === "solid") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold";
  if (band === "below_threshold") return "bg-amber-500/10 text-amber-800 dark:text-amber-300 font-medium";
  return "text-muted-foreground/50";
}

function statusText(concept: ConceptDashboardRow): string {
  if (concept.pKnow === null) return "Not recorded";
  const value = formatMastery(concept.pKnow);
  if (concept.band === "solid") return `Solid, ${value}`;
  return `Below threshold, ${value}`;
}

function prerequisiteText(concept: ConceptDashboardRow): string {
  if (concept.prerequisites.length === 0) return "None";
  return concept.prerequisites
    .map((item) => {
      if (item.state === "met") return `${item.name} meets threshold`;
      if (item.state === "below") return `${item.name} below threshold`;
      return `${item.name} not recorded`;
    })
    .join(". ");
}

function updateText(concept: ConceptDashboardRow): string {
  const tagged = concept.recentTagged
    ? ` Of last ${concept.recentTagged.counted} graded submissions, ${concept.recentTagged.passedAll} passed.`
    : "";
  if (!concept.latestUpdate) {
    return concept.pKnow === null
      ? `No mastery record.${tagged}`
      : `Mastery record stored.${tagged}`;
  }
  const cause = concept.latestUpdate.causeType === "attempt" ? "Graded attempt" : `${concept.latestUpdate.causeType} update`;
  return `${cause} moved from ${concept.latestUpdate.before.toFixed(2)} to ${concept.latestUpdate.after.toFixed(2)} at ${concept.latestUpdate.at}.${tagged}`;
}

function hiddenText(attempt: AttemptDashboardRow): string {
  if (attempt.passed !== null && attempt.total !== null) {
    return `${attempt.passed}/${attempt.total} passed${attempt.passRate === null ? "" : ` (${formatMastery(attempt.passRate)})`}`;
  }
  if (attempt.passRate === null) return "No score stored";
  return formatMastery(attempt.passRate);
}

