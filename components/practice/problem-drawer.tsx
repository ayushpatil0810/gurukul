"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Circle, Clock, Flame, ListFilter, Search, X } from "lucide-react";
import type { ChallengeDifficulty, ChallengeStatus } from "@/lib/services/practice";

type ChallengeItem = {
  id: string;
  number: number;
  title: string;
  difficultyLabel: ChallengeDifficulty;
  status: ChallengeStatus;
};

interface ProblemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  challenges: ChallengeItem[];
  activeQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  moduleName?: string;
}

export function ProblemDrawer({
  isOpen,
  onClose,
  challenges,
  activeQuestionId,
  onSelectQuestion,
  moduleName,
}: ProblemDrawerProps) {
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | ChallengeDifficulty>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | ChallengeStatus>("All");
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      if (difficultyFilter !== "All" && c.difficultyLabel !== difficultyFilter) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(query) ||
          c.number.toString().includes(query)
        );
      }
      return true;
    });
  }, [challenges, difficultyFilter, statusFilter, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-12 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={drawerRef}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl shadow-black/40 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListFilter className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                Problem Catalog
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {moduleName ?? "Module Challenges"} · {challenges.length} problems
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="border-b border-border/60 p-3.5 bg-background space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search problem title or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-muted/40 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Difficulty Tabs */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">
                Difficulty:
              </span>
              {(["All", "Easy", "Medium", "Hard"] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficultyFilter(diff)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    difficultyFilter === diff
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">
                Status:
              </span>
              {(["All", "solved", "attempted", "todo"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`capitalize rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    statusFilter === st
                      ? "bg-secondary text-secondary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Challenges List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-1">
          {filteredChallenges.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No challenges match your filter criteria.
            </div>
          ) : (
            filteredChallenges.map((c) => {
              const isActive = c.id === activeQuestionId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectQuestion(c.id);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition-colors rounded-lg ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/60 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status Icon */}
                    <div className="shrink-0">
                      {c.status === "solved" ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : c.status === "attempted" ? (
                        <Clock className="size-4 text-amber-500" />
                      ) : (
                        <Circle className="size-3.5 text-muted-foreground/40" />
                      )}
                    </div>

                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground w-6">
                      {c.number}.
                    </span>

                    <span className="truncate font-medium">
                      {c.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                        c.difficultyLabel === "Easy"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : c.difficultyLabel === "Medium"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {c.difficultyLabel}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-border/60 bg-muted/30 px-5 py-2.5 text-right text-[11px] text-muted-foreground">
          Showing {filteredChallenges.length} of {challenges.length} problems · Mode: Practice (Ungraded)
        </div>
      </div>
    </div>
  );
}
