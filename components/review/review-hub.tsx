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
  Flame,
  Gavel,
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
import type { ReviewQueueItem } from "@/lib/services/integrity";
import { IntegrityThreatMap } from "./integrity-threat-map";
import { StudentIntegrityCard, type StudentIntegrityGroup } from "./student-integrity-card";
import { QuickVerdictDrawer } from "./quick-verdict-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReviewHubProps {
  initialItems: ReviewQueueItem[];
  batches: { id: string; name: string }[];
}

export function ReviewHub({ initialItems, batches }: ReviewHubProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [selectedPattern, setSelectedPattern] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeSignalForVerdict, setActiveSignalForVerdict] = useState<ReviewQueueItem | null>(null);
  const [isVerdictDrawerOpen, setIsVerdictDrawerOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(true);

  // Compute KPI metrics
  const kpis = useMemo(() => {
    const totalSignals = items.length;
    const uniqueStudents = new Set(items.map((i) => i.studentId)).size;
    const highSeverity = items.filter((i) => i.strength === "high").length;
    const pendingTriage = items.filter((i) => i.reviewStatus === "pending").length;
    const needsViva = items.filter((i) => i.reviewStatus === "needs_viva").length;

    return {
      totalSignals,
      uniqueStudents,
      highSeverity,
      pendingTriage,
      needsViva,
    };
  }, [items]);

  // Group signals by student
  const studentGroups = useMemo(() => {
    const map = new Map<string, StudentIntegrityGroup>();
    for (const item of items) {
      const existing = map.get(item.studentId);
      if (!existing) {
        map.set(item.studentId, {
          studentId: item.studentId,
          studentName: item.studentName,
          studentEmail: item.studentEmail,
          batchName: item.batchName,
          signals: [item],
        });
      } else {
        existing.signals.push(item);
      }
    }
    return Array.from(map.values());
  }, [items]);

  // Filter student groups
  const filteredStudentGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return studentGroups.filter((group) => {
      // Search query
      const matchesSearch =
        !q ||
        group.studentName.toLowerCase().includes(q) ||
        (group.studentEmail && group.studentEmail.toLowerCase().includes(q)) ||
        group.signals.some((s) => s.questionStatement.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Batch filter
      if (selectedBatch !== "all" && group.batchName !== selectedBatch) {
        return false;
      }

      // Pattern filter
      if (selectedPattern !== "all") {
        const hasPattern = group.signals.some((s) => s.type === selectedPattern);
        if (!hasPattern) return false;
      }

      // Status filter
      if (selectedStatus !== "all") {
        const hasStatus = group.signals.some((s) => s.reviewStatus === selectedStatus);
        if (!hasStatus) return false;
      }

      return true;
    });
  }, [studentGroups, searchQuery, selectedBatch, selectedPattern, selectedStatus]);

  const handleOpenVerdictDrawer = (signal: ReviewQueueItem) => {
    setActiveSignalForVerdict(signal);
    setIsVerdictDrawerOpen(true);
  };

  const handleVerdictApplied = (signalId: string, disposition: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === signalId ? { ...item, reviewStatus: disposition } : item
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 font-mono">
              Integrity Diagnostics
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs text-muted-foreground">Student Anomaly Review</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Integrity Review & Audit Hub
          </h1>
          <p className="text-xs text-muted-foreground">
            Investigate suspicious keystroke velocity spikes, code paste insertions, and schedule viva oral defenses.
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
            {isMapExpanded ? "Hide Risk Threat Map" : "Show Risk Threat Map"}
          </Button>

          <Button asChild size="sm" variant="secondary" className="gap-1.5 text-xs font-medium">
            <Link href="/replay">
              <History className="size-3.5 text-primary" />
              <span>Session Replay Hub</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Signals</span>
            <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {kpis.totalSignals}
          </p>
          <p className="text-[11px] text-muted-foreground">Detected behavioral anomalies</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Flagged Students</span>
            <Users className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {kpis.uniqueStudents}
          </p>
          <p className="text-[11px] text-muted-foreground">Students with active flags</p>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-destructive">
            <span className="text-xs font-medium">High Severity</span>
            <Flame className="size-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-destructive font-mono">
            {kpis.highSeverity}
          </p>
          <p className="text-[11px] text-muted-foreground">High confidence &ge; 85%</p>
        </div>

        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300">
            <span className="text-xs font-medium">Pending Triage</span>
            <Gavel className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-purple-700 dark:text-purple-300 font-mono">
            {kpis.pendingTriage}
          </p>
          <p className="text-[11px] text-muted-foreground">Awaiting trainer verdict</p>
        </div>
      </div>

      {/* INTEGRITY THREAT MAP */}
      {isMapExpanded ? (
        <IntegrityThreatMap
          signals={items}
          onSelectSignalForVerdict={handleOpenVerdictDrawer}
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
              placeholder="Search student name, email, or question keyword…"
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

          {/* FILTER DROPDOWNS & CHIPS */}
          <div className="flex flex-wrap items-center gap-2">
            {/* BATCH SELECTOR */}
            {batches.length > 0 ? (
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-2xs"
              >
                <option value="all">All Cohorts</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : null}

            {/* PATTERN SELECTOR */}
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-2xs"
            >
              <option value="all">All Anomaly Patterns</option>
              <option value="large_paste">Large Code Paste</option>
              <option value="faster_than_rhythm">Typing Velocity Burst</option>
              <option value="no_write_run_fix">No Write-Run-Fix Loop</option>
              <option value="evenly_typed">Uniform Cadence</option>
            </select>

            {/* STATUS SELECTOR */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-2xs"
            >
              <option value="all">All Review Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="needs_viva">Needs Viva</option>
              <option value="escalated">Escalated</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2 font-mono">
          <span>
            Showing <strong className="text-foreground">{filteredStudentGroups.length}</strong> of{" "}
            <strong>{studentGroups.length}</strong> flagged students
          </span>
          <span className="text-muted-foreground">
            Heuristics reflect automated detection. Each signal requires human review.
          </span>
        </div>
      </div>

      {/* STUDENT INTEGRITY CARDS LIST */}
      {filteredStudentGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <ShieldCheck className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-foreground">No Integrity Signals Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No telemetry signals match your search criteria. Try adjusting or clearing your filters.
          </p>
          {(searchQuery || selectedBatch !== "all" || selectedPattern !== "all" || selectedStatus !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedBatch("all");
                setSelectedPattern("all");
                setSelectedStatus("all");
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
            <StudentIntegrityCard
              key={group.studentId}
              group={group}
              onSelectSignalForVerdict={handleOpenVerdictDrawer}
            />
          ))}
        </div>
      )}

      {/* QUICK VERDICT SLIDE-OVER DRAWER */}
      <QuickVerdictDrawer
        signal={activeSignalForVerdict}
        isOpen={isVerdictDrawerOpen}
        onClose={() => {
          setIsVerdictDrawerOpen(false);
          setActiveSignalForVerdict(null);
        }}
        onVerdictApplied={handleVerdictApplied}
      />
    </div>
  );
}
