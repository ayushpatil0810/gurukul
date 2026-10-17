"use client";

import { useState } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Code2,
  FileDown,
  Layers,
  Pencil,
  Play,
  Plus,
  SlidersHorizontal,
  Terminal,
  User,
  X,
  Activity,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import type { TooltipContentProps } from "recharts";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRightIcon,
  CalendarDotsIcon,
  CaretDownIcon,
  ClockIcon,
  FileArrowUpIcon,
} from "./portal-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  curriculumModuleLoad,
  recentAssessments,
  assessmentStatusFilters,
  filterAssessments,
  studentCohortPerformance,
  sandboxResources,
  portalMetrics,
  portalTimelineRanges,
  weeklyVolumeData,
  type AssessmentRow,
  type AssessmentStatus,
  type AssessmentStatusFilter,
} from "./portal-data";
import { cn } from "cn";

const dashboardColors = {
  scheduled: "var(--dashboard-learning)",
  completed: "var(--dashboard-mastered)",
  noShow: "var(--dashboard-remediation)",
  secondary: "var(--dashboard-secondary)",
  destructive: "var(--destructive)",
} as const;

const chartSeries = [
  { key: "scheduled", label: "Sandbox Runs", color: dashboardColors.scheduled },
  { key: "completed", label: "Passed Assertions", color: dashboardColors.completed },
  { key: "noShow", label: "Requires Fix", color: dashboardColors.noShow },
] as const;

const statusClassName: Record<AssessmentStatus, string> = {
  Passed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  "In progress": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  "Needs fix": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  Evaluating: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
};

function DashboardCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-border/70 bg-card p-4.5 text-card-foreground shadow-xs",
        className
      )}
    >
      {children}
    </section>
  );
}

function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
      {action ? (
        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-foreground/80">
          {action}
        </div>
      ) : null}
    </div>
  );
}

function MetricBars({
  lastSixDays,
  className,
}: {
  lastSixDays: readonly number[];
  className: string;
}) {
  const maximum = Math.max(...lastSixDays, 1);

  return (
    <div className="flex h-7.5 w-10 shrink-0 items-end justify-between">
      {lastSixDays.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={cn("w-1.25 rounded-t-sm", className)}
          style={{ height: `${(value / maximum) * 100}%` }}
        />
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      <p className="mb-2 font-semibold">{label}</p>
      <div className="flex flex-col gap-1.5">
        {payload.map((item, index) => (
          <div
            key={`${String(item.dataKey)}-${index}`}
            className="flex items-center justify-between gap-6"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessmentVolumeCard() {
  return (
    <DashboardCard className="flex flex-col gap-4 pb-0">
      <CardHeader
        title="Assessment & Sandbox Volume"
        action={
          <Link
            href="/curriculum"
            className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-foreground hover:underline"
          >
            <span>View Syllabus</span>
            <ArrowUpRightIcon className="size-4" />
          </Link>
        }
      />

      <div className="grid flex-1 gap-6 md:grid-cols-[7.5rem_minmax(0,1fr)]">
        <div className="grid grid-cols-3 gap-4 md:flex md:flex-col md:justify-center md:gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[1.75rem] font-bold leading-none text-foreground">
              1,064
            </p>
            <p className="text-xs text-muted-foreground">Total runs this sprint</p>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[1.75rem] font-bold leading-none text-emerald-600 dark:text-emerald-400">
              92%
            </p>
            <p className="text-xs text-muted-foreground">Hidden test pass rate</p>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[1.75rem] font-bold leading-none text-foreground">
              142ms
            </p>
            <p className="text-xs text-muted-foreground">Average execution</p>
          </div>
        </div>

        <div className="min-h-0 min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-3 text-xs">
            {chartSeries.map((series) => (
              <div
                key={series.key}
                className="flex items-center gap-1.5 font-medium text-foreground/80"
              >
                <span
                  className="size-2.5 rounded-xs"
                  style={{ backgroundColor: series.color }}
                />
                {series.label}
              </div>
            ))}
          </div>
          <div className="h-64 min-w-md md:min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...weeklyVolumeData]}
                barGap={4}
                barCategoryGap="22%"
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.65}
                />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  dy={6}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 300]}
                  ticks={[0, 75, 150, 225, 300]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  width={34}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                  content={(props) => <ChartTooltip {...props} />}
                />
                <Bar
                  dataKey="scheduled"
                  name="Runs"
                  fill={dashboardColors.scheduled}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="completed"
                  name="Passed"
                  fill={dashboardColors.completed}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="noShow"
                  name="Failed"
                  fill={dashboardColors.noShow}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

function CurriculumModuleLoadCard() {
  const totalWeight = curriculumModuleLoad.reduce(
    (total, item) => total + item.value,
    0
  );

  return (
    <DashboardCard className="flex flex-col gap-4">
      <CardHeader
        title="Curriculum Syllabus Load"
        action={
          <Link
            href="/curriculum"
            className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-foreground hover:underline"
          >
            <span>DAG View</span>
            <ArrowUpRightIcon className="size-4" />
          </Link>
        }
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Active Topics Weighted</span>
            <span className="font-semibold text-foreground">
              {totalWeight} Concepts
            </span>
          </div>
          <div className="flex h-5 items-start gap-1 overflow-hidden rounded-md bg-muted/40 p-0.5">
            {curriculumModuleLoad.map((item, index) => (
              <span
                key={item.label}
                className={cn(
                  "dashboard-load-segment h-full min-w-3 shrink-0 rounded-xs",
                  item.color
                )}
                style={
                  {
                    "--department-width": `${(item.value / totalWeight) * 100}%`,
                    animationDelay: `${index * 80}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          {curriculumModuleLoad.map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 items-center gap-2 text-xs"
            >
              <div className="flex min-w-0 shrink-0 items-center gap-2">
                <span className={cn("size-3 rounded-xs shrink-0", item.color)} />
                <span className="truncate font-medium text-foreground/85">
                  {item.label}
                </span>
              </div>
              <span className="min-w-0 flex-1 border-t border-dashed border-border" />
              <div className="flex shrink-0 items-center gap-2">
                <span className="w-6 text-right font-semibold text-foreground">
                  {item.value}
                </span>
                <span className="w-12 text-right text-muted-foreground font-mono">
                  {item.percent}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function AssessmentDetailsSheet({
  assessment,
  open,
  onOpenChange,
}: {
  assessment: AssessmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full! max-w-full! overflow-hidden bg-background sm:p-4 shadow-lg sm:w-130! sm:max-w-130! border-l border-border"
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 px-6">
            <SheetTitle className="text-lg font-semibold tracking-tight">
              Assessment Verification Record
            </SheetTitle>
          </header>

          {assessment ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 no-scrollbar space-y-6">
              <SheetDescription className="sr-only">
                Verification details for {assessment.student}
              </SheetDescription>

              {/* Header profile */}
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="border border-border/80">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {assessment.student.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-xl font-bold tracking-tight text-foreground truncate">
                    {assessment.student}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {assessment.concept} &bull; {assessment.language}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        statusClassName[assessment.status]
                      )}
                    >
                      {assessment.status}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {assessment.testsPassed}
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Specs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                  <span className="text-[11px] text-muted-foreground">Sandbox Time</span>
                  <p className="text-base font-bold font-mono">{assessment.runtime}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                  <span className="text-[11px] text-muted-foreground">Memory Ceiling</span>
                  <p className="text-base font-bold font-mono">{assessment.memory}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                  <span className="text-[11px] text-muted-foreground">BKT Delta</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    +0.12
                  </p>
                </div>
              </div>

              {/* Code Snapshot */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Terminal className="size-3.5 text-primary" />
                    <span>Submitted Solution Snapshot</span>
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    SHA-256 Verified
                  </span>
                </div>
                <pre className="rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs overflow-x-auto leading-relaxed text-foreground/90">
                  <code>{assessment.codeSnippet}</code>
                </pre>
              </div>

              {/* Routing Explanation */}
              <div className="rounded-lg border border-border bg-card p-3.5 space-y-1 text-xs">
                <span className="font-semibold text-foreground">Next Adaptation Decision</span>
                <p className="text-muted-foreground leading-relaxed">
                  Prerequisites satisfied with high posterior confidence. Scheduled for advanced
                  multi-container container networking assessment.
                </p>
              </div>
            </div>
          ) : null}

          <footer className="border-t border-border/60 p-4 flex gap-3">
            <Button asChild variant="secondary" className="flex-1 text-xs font-semibold">
              <Link href="/practice">
                <Play className="size-3.5" />
                <span>Practice Workspace</span>
              </Link>
            </Button>
            <Button asChild className="flex-1 text-xs font-semibold">
              <Link href="/replay">
                <Activity className="size-3.5" />
                <span>Open Replay</span>
              </Link>
            </Button>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RecentAssessmentsTableCard({
  onSelectAssessment,
}: {
  onSelectAssessment: (row: AssessmentRow) => void;
}) {
  const [filter, setFilter] = useState<AssessmentStatusFilter>("all");
  const filtered = filterAssessments(recentAssessments, filter);

  return (
    <DashboardCard className="flex flex-col gap-4 px-0 pb-0">
      <CardHeader
        className="px-4"
        title="Live Assessment Submissions"
        action={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={buttonVariants({
                  variant: "ghost",
                  className: "h-7.5 gap-1.5 px-2 text-xs",
                })}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>Filter ({filter})</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filter}
                  onValueChange={(val) => setFilter(val as AssessmentStatusFilter)}
                >
                  {assessmentStatusFilters.map((f) => (
                    <DropdownMenuRadioItem key={f.value} value={f.value}>
                      {f.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full min-w-140 table-fixed text-left text-xs">
          <thead>
            <tr className="h-10 border-b border-border/60 text-muted-foreground font-semibold">
              <th className="w-[12%] px-4">Time</th>
              <th className="w-[24%] px-4">Student</th>
              <th className="w-[28%] px-4">Concept</th>
              <th className="w-[16%] px-4">Runtime</th>
              <th className="w-[20%] px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={`${row.time}-${row.student}`}
                onClick={() => onSelectAssessment(row)}
                className="h-14 cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/40"
              >
                <td className="px-4 font-mono text-muted-foreground">{row.time}</td>
                <td className="px-4 font-medium text-foreground">{row.student}</td>
                <td className="px-4 text-muted-foreground truncate">{row.concept}</td>
                <td className="px-4 font-mono text-foreground/80">{row.runtime}</td>
                <td className="px-4">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-tight",
                      statusClassName[row.status]
                    )}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

function StudentCohortCard() {
  return (
    <DashboardCard className="flex flex-col gap-3 px-0 pb-0">
      <CardHeader
        className="px-4"
        title="Top Concept Mastery"
        action={
          <Link
            href="/curriculum"
            className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-foreground hover:underline"
          >
            <span>All students</span>
            <ArrowUpRightIcon className="size-4" />
          </Link>
        }
      />

      <div className="flex flex-col divide-y divide-border/60">
        {studentCohortPerformance.map((student) => (
          <div
            key={student.name}
            className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar size="sm" className="border border-border/60">
                <AvatarImage src={student.avatar} alt={student.name} />
                <AvatarFallback>{student.name[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {student.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {student.role}
                </p>
              </div>
            </div>
            <div className="flex items-end flex-col">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {student.rating}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {student.points} pts
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function SandboxResourceUsageCard() {
  return (
    <DashboardCard className="flex flex-col gap-4">
      <CardHeader
        title="Sandbox Infrastructure"
        action={
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        }
      />

      <div className="flex flex-col gap-4">
        {sandboxResources.map((res, index) => (
          <div
            key={res.label}
            className={cn(
              "flex flex-col gap-1.5",
              index > 0 && "border-t border-border/60 pt-3"
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{res.label}</span>
              <span className="font-semibold text-foreground font-mono">
                {res.value}% <span className="text-muted-foreground font-normal">{res.unit}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "dashboard-resource-progress block h-full rounded-full",
                  res.color
                )}
                style={{ width: `${res.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

export function PortalDashboardView({
  userName = "Learner",
  role = "student",
}: {
  userName?: string;
  role?: string;
}) {
  const [selectedRange, setSelectedRange] = useState("current-sprint");
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentRow | null>(
    null
  );

  const selectedRangeMeta = portalTimelineRanges.find(
    (range) => range.value === selectedRange
  );

  return (
    <div className="portal-dashboard flex flex-col gap-6 p-4 md:p-6">
      {/* Greeting Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/60 pb-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Good morning, {userName}
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDotsIcon />
            <span>Sprint 14 &bull; Engineering Assessment Cycle</span>
            <span>&bull;</span>
            <span className="capitalize font-medium text-foreground/80">{role} Workspace</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "h-9 gap-1.5 text-xs font-medium",
              })}
            >
              <CalendarDotsIcon className="size-3.5" />
              <span>{selectedRangeMeta?.label}</span>
              <CaretDownIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuRadioGroup
                value={selectedRange}
                onValueChange={(val) => setSelectedRange(val)}
              >
                {portalTimelineRanges.map((r) => (
                  <DropdownMenuRadioItem key={r.value} value={r.value}>
                    {r.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
            <Link href={role === "student" ? "/practice" : "/studio/new"}>
              <Plus className="size-4" />
              <span>{role === "student" ? "Start Practice" : "New Lesson"}</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* 4 Metric Cards */}
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {portalMetrics.map((metric) => (
            <article
              key={metric.label}
              className="flex h-32 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </h2>
                <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
              </div>

              <div className="flex items-end gap-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold leading-none text-foreground font-mono">
                    {metric.value}
                    {metric.suffix ? (
                      <span className="ml-0.5 text-sm font-normal text-muted-foreground">
                        {metric.suffix}
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                    <ArrowUpRightIcon className={cn("size-3.5", metric.trendColor)} />
                    <span className="text-foreground/90 font-medium">{metric.trend}</span>
                  </div>
                </div>
                <MetricBars
                  lastSixDays={metric.lastSixDays}
                  className={metric.color}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <AssessmentVolumeCard />
        <CurriculumModuleLoadCard />
      </section>

      {/* Table & Resource Panels */}
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <RecentAssessmentsTableCard
          onSelectAssessment={(item) => setSelectedAssessment(item)}
        />
        <div className="grid min-w-0 gap-4 self-start">
          <StudentCohortCard />
          <SandboxResourceUsageCard />
        </div>
      </section>

      {/* Verification Drawer Sheet */}
      <AssessmentDetailsSheet
        assessment={selectedAssessment}
        open={selectedAssessment !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAssessment(null);
        }}
      />
    </div>
  );
}
