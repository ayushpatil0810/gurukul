"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  Filter,
  Layers,
  Play,
  Search,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";
import type {
  ChallengeDifficulty,
  ChallengeStatus,
  PracticeCatalogData,
  PracticeChallengeSummary,
} from "@/lib/services/practice";

interface ChallengeCatalogProps {
  catalog: PracticeCatalogData;
  onSelectChallenge: (questionId: string) => void;
  onSelectModule: (moduleId: string) => void;
}

export function ChallengeCatalog({
  catalog,
  onSelectChallenge,
  onSelectModule,
}: ChallengeCatalogProps) {
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | ChallengeDifficulty>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | ChallengeStatus>("All");

  const filteredChallenges = useMemo(() => {
    return catalog.challenges.filter((c) => {
      if (difficultyFilter !== "All" && c.difficultyLabel !== difficultyFilter) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(query) ||
          c.statement.toLowerCase().includes(query) ||
          c.conceptName.toLowerCase().includes(query) ||
          c.number.toString().includes(query)
        );
      }
      return true;
    });
  }, [catalog.challenges, difficultyFilter, statusFilter, search]);

  const solvedPercent =
    catalog.stats.total > 0
      ? Math.round((catalog.stats.solved / catalog.stats.total) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Module Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Code2 className="size-4" />
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Practice Lab
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Interactive, ungraded coding laboratory. Solve challenges with respect to your modules, run live tests, and build mastery at your own pace.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Mode: Practice & Ungraded</span>
          </div>

          <Link
            href="/assessment"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <ShieldAlert className="size-3.5" />
            <span>Take Official OA &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Module Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
        <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
          <Layers className="size-3.5" />
          Enrolled Modules:
        </span>

        {/* All Modules Option */}
        <button
          type="button"
          onClick={() => onSelectModule("all")}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            catalog.activeModuleId === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border/80 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>All Modules</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
              catalog.activeModuleId === "all"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {catalog.challenges.length}
          </span>
        </button>

        {/* Individual Modules */}
        {catalog.modules.map((mod) => {
          const isSelected = catalog.activeModuleId === mod.id;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelectModule(mod.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{mod.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {mod.solvedChallenges}/{mod.totalChallenges}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress & Stats Cards (LeetCode Style) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Overall Solved Progress */}
        <div className="md:col-span-5 rounded-2xl border border-border/80 bg-card/70 p-5 shadow-xs backdrop-blur-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Challenge Progress
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {catalog.stats.solved}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  / {catalog.stats.total} Solved ({solvedPercent}%)
                </span>
              </div>
            </div>
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Trophy className="size-6 text-primary" />
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted flex">
              <div
                style={{
                  width: `${catalog.stats.total > 0 ? (catalog.stats.easy.solved / catalog.stats.total) * 100 : 0}%`,
                }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Easy Solved: ${catalog.stats.easy.solved}`}
              />
              <div
                style={{
                  width: `${catalog.stats.total > 0 ? (catalog.stats.medium.solved / catalog.stats.total) * 100 : 0}%`,
                }}
                className="bg-amber-500 h-full transition-all duration-300"
                title={`Medium Solved: ${catalog.stats.medium.solved}`}
              />
              <div
                style={{
                  width: `${catalog.stats.total > 0 ? (catalog.stats.hard.solved / catalog.stats.total) * 100 : 0}%`,
                }}
                className="bg-rose-500 h-full transition-all duration-300"
                title={`Hard Solved: ${catalog.stats.hard.solved}`}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {catalog.stats.attempted} in progress · {catalog.stats.total - catalog.stats.solved - catalog.stats.attempted} unattempted
            </p>
          </div>
        </div>

        {/* Difficulty Breakdown Cards */}
        <div className="md:col-span-7 grid grid-cols-3 gap-3">
          {/* Easy */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Easy
              </span>
              <p className="text-xl font-bold text-foreground mt-1">
                {catalog.stats.easy.solved}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {catalog.stats.easy.total}
                </span>
              </p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-emerald-500/20 overflow-hidden mt-3">
              <div
                style={{
                  width: `${catalog.stats.easy.total > 0 ? (catalog.stats.easy.solved / catalog.stats.easy.total) * 100 : 0}%`,
                }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
          </div>

          {/* Medium */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Medium
              </span>
              <p className="text-xl font-bold text-foreground mt-1">
                {catalog.stats.medium.solved}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {catalog.stats.medium.total}
                </span>
              </p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-amber-500/20 overflow-hidden mt-3">
              <div
                style={{
                  width: `${catalog.stats.medium.total > 0 ? (catalog.stats.medium.solved / catalog.stats.medium.total) * 100 : 0}%`,
                }}
                className="h-full bg-amber-500 rounded-full"
              />
            </div>
          </div>

          {/* Hard */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Hard
              </span>
              <p className="text-xl font-bold text-foreground mt-1">
                {catalog.stats.hard.solved}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {catalog.stats.hard.total}
                </span>
              </p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-rose-500/20 overflow-hidden mt-3">
              <div
                style={{
                  width: `${catalog.stats.hard.total > 0 ? (catalog.stats.hard.solved / catalog.stats.hard.total) * 100 : 0}%`,
                }}
                className="h-full bg-rose-500 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search challenges by keyword, topic, or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border/80 bg-background py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Difficulty Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px]">Difficulty:</span>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as "All" | ChallengeDifficulty)}
              className="rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-hidden"
            >
              <option value="All">All Levels</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "All" | ChallengeStatus)}
              className="rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-hidden capitalize"
            >
              <option value="All">All Status</option>
              <option value="solved">Solved</option>
              <option value="attempted">Attempted</option>
              <option value="todo">Todo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Challenge List Table (LeetCode Style) */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 w-12 text-center">Status</th>
                <th className="py-3 px-4">Challenge Title</th>
                <th className="py-3 px-4">Concept / Topic</th>
                <th className="py-3 px-4 w-28 text-center">Acceptance</th>
                <th className="py-3 px-4 w-24 text-center">Difficulty</th>
                <th className="py-3 px-4 w-32 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredChallenges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    No challenges match your filter criteria. Try adjusting your search query.
                  </td>
                </tr>
              ) : (
                filteredChallenges.map((challenge) => (
                  <tr
                    key={challenge.id}
                    onClick={() => onSelectChallenge(challenge.id)}
                    className="group hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    {/* Status Icon */}
                    <td className="py-3 px-4 text-center">
                      {challenge.status === "solved" ? (
                        <CheckCircle2 className="size-4.5 text-emerald-500 inline-block" />
                      ) : challenge.status === "attempted" ? (
                        <Clock className="size-4.5 text-amber-500 inline-block" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground/30 inline-block" />
                      )}
                    </td>

                    {/* Title & Preview */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {challenge.number}.
                        </span>
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {challenge.title}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1 max-w-lg">
                        {challenge.statement}
                      </p>
                    </td>

                    {/* Concept */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {challenge.conceptName}
                      </span>
                    </td>

                    {/* Acceptance */}
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-muted-foreground">
                      {challenge.acceptanceRate}%
                    </td>

                    {/* Difficulty Badge */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block rounded-md px-2.5 py-0.5 text-[10px] font-bold border ${
                          challenge.difficultyLabel === "Easy"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : challenge.difficultyLabel === "Medium"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {challenge.difficultyLabel}
                      </span>
                    </td>

                    {/* Solve Prompt */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectChallenge(challenge.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs"
                      >
                        <Play className="size-3 fill-current" />
                        <span>Solve</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-border/70 bg-muted/30 px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {filteredChallenges.length} of {catalog.challenges.length} challenges in {catalog.activeModuleName}
          </span>
          <span className="text-[11px]">
            Tip: All practice challenges are ungraded with instant sandbox feedback.
          </span>
        </div>
      </div>
    </div>
  );
}
