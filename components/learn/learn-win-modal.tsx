"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  HelpCircle,
  Layers,
  Network,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseConceptItem } from "@/lib/services/learn-module";
import { cn } from "cn";

export function LearnWinModal({
  concept,
  courseName,
  isCompleted,
  onClose,
  onMarkCompleted,
  onLaunchQuiz,
}: {
  concept: CourseConceptItem;
  courseName: string;
  isCompleted: boolean;
  onClose: () => void;
  onMarkCompleted: (conceptId: string) => void;
  onLaunchQuiz: (concept: CourseConceptItem) => void;
}) {
  const [activeTab, setActiveTab] = useState<"docs" | "slides">("docs");
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [studiedSeconds, setStudiedSeconds] = useState(0);
  const [localCompleted, setLocalCompleted] = useState(isCompleted);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Coverage tracking state (Anti-Speedrun)
  const [docsCoverage, setDocsCoverage] = useState(isCompleted ? 100 : 15);
  const [slidesCoverage, setSlidesCoverage] = useState(isCompleted ? 100 : Math.round((1 / (concept.slides.length || 1)) * 100));
  const [isAtEndOfDocs, setIsAtEndOfDocs] = useState(isCompleted);
  const [showExitWarning, setShowExitWarning] = useState(false);

  const docsContainerRef = useRef<HTMLDivElement>(null);
  const totalSlides = concept.slides.length || 1;
  const currentSlide = concept.slides[currentSlideIdx] || concept.slides[0];

  // Active study duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setStudiedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor scroll in docs view to track coverage
  const handleDocsScroll = () => {
    const el = docsContainerRef.current;
    if (!el) return;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const scrollTop = el.scrollTop;

    if (scrollHeight <= clientHeight) {
      setDocsCoverage(100);
      setIsAtEndOfDocs(true);
      return;
    }

    const currentPercent = Math.min(100, Math.round(((scrollTop + clientHeight) / scrollHeight) * 100));
    setDocsCoverage((prev) => Math.max(prev, currentPercent));

    // End of documentation reached when near the bottom (within 120px) or >= 92%
    if (scrollHeight - (scrollTop + clientHeight) < 120 || currentPercent >= 92) {
      setIsAtEndOfDocs(true);
    }
  };

  // Keyboard navigation for slides
  useEffect(() => {
    if (activeTab !== "slides") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentSlideIdx((prev) => {
          const next = Math.min(totalSlides - 1, prev + 1);
          const percent = Math.round(((next + 1) / totalSlides) * 100);
          setSlidesCoverage((c) => Math.max(c, percent));
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlideIdx((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, totalSlides]);

  const handleNextSlide = () => {
    setCurrentSlideIdx((prev) => {
      const next = Math.min(totalSlides - 1, prev + 1);
      const percent = Math.round(((next + 1) / totalSlides) * 100);
      setSlidesCoverage((c) => Math.max(c, percent));
      return next;
    });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // 70% Anti-Speedrun Coverage Threshold Check
  const activeCoverage = activeTab === "docs" ? docsCoverage : slidesCoverage;
  const maxOverallCoverage = Math.max(docsCoverage, slidesCoverage);
  const hasReached70Percent = maxOverallCoverage >= 70 || localCompleted;
  const canShowTakeQuizButton =
    (hasReached70Percent && (isAtEndOfDocs || currentSlideIdx === totalSlides - 1)) || localCompleted;

  const handleCompleteStudy = () => {
    setLocalCompleted(true);
    onMarkCompleted(concept.id);
  };

  const toggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleRequestClose = () => {
    if (!hasReached70Percent) {
      setShowExitWarning(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-background animate-in fade-in duration-200 select-none overflow-hidden">
      
      {/* Premature Exit Confirmation Modal (Anti-Speedrun Guard) */}
      {showExitWarning ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="max-w-md w-full rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-foreground">
                  Anti-Speedrun Requirement
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You have only covered <strong>{maxOverallCoverage}%</strong> of this concept. The course requires at least <strong>70% coverage</strong> before the <strong>Done</strong> and <strong>Take Concept Quiz</strong> buttons unlock.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
              Are you sure you want to exit? Your progress will be saved, but the concept quiz will remain locked until 70% is covered.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowExitWarning(false)}
                className="text-xs font-semibold"
              >
                Resume Course
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => {
                  setShowExitWarning(false);
                  onClose();
                }}
                className="text-xs"
              >
                Exit Anyway
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/95 px-5 py-3 shrink-0 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-mono font-bold text-sm shadow-xs">
            {concept.step}
          </span>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {courseName} · Step {concept.step}
              </span>
              {concept.isGoal ? (
                <span className="rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[9px] font-bold">
                  Capstone Goal
                </span>
              ) : null}
              {hasReached70Percent ? (
                <span className="rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold">
                  ≥ 70% Covered ✓
                </span>
              ) : (
                <span className="rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[9px] font-bold">
                  {maxOverallCoverage}% / 70% Required
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight line-clamp-1">
              {concept.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("docs")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                activeTab === "docs"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="size-3.5" />
              <span>Documentation</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("slides")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                activeTab === "slides"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Layers className="size-3.5" />
              <span>Presentation Slides</span>
              <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-mono">
                {totalSlides}
              </span>
            </button>
          </div>

          {/* Active Study Timer */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1 text-xs font-mono text-muted-foreground shadow-2xs">
            <Clock className="size-3.5 text-primary animate-pulse" />
            <span>{formatTimer(studiedSeconds)}</span>
            <span className="text-[10px] text-muted-foreground/60">/ {concept.estimatedMinutes}m</span>
          </div>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleNativeFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Native Fullscreen"}
            className="rounded-lg text-muted-foreground hover:text-foreground hidden sm:flex"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRequestClose}
            aria-label="Exit LearnWin"
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Learning Canvas */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "docs" ? (
          /* -------------------------------------------------------------------------- */
          /*                               DOCS VIEW                                    */
          /* -------------------------------------------------------------------------- */
          <div
            ref={docsContainerRef}
            onScroll={handleDocsScroll}
            className="h-full overflow-y-auto px-4 py-8 sm:px-8 md:px-12 no-scrollbar"
          >
            <div className="max-w-4xl mx-auto space-y-8 pb-16">
              {/* Executive Overview Banner */}
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-secondary/20 p-6 sm:p-8 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Courseware Documentation
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    Estimated Reading: ~{concept.docs.estimatedMinutes} mins
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {concept.docs.title}
                </h3>
                <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
                  {concept.docs.overview}
                </p>
              </div>

              {/* Learning Objectives */}
              {concept.docs.learningObjectives.length > 0 ? (
                <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Key Conceptual Learning Objectives</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {concept.docs.learningObjectives.map((obj, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/90">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Architectural Mental Model */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                  <Network className="size-4 text-primary" />
                  <h4 className="text-lg font-bold text-foreground">
                    Architectural Mental Model & Mechanics
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {concept.docs.mentalModelDescription}
                </p>
              </div>

              {/* Detailed Sections with Code */}
              {concept.docs.sections.map((sec) => (
                <div key={sec.id} className="space-y-3 pt-2">
                  <h4 className="text-lg font-bold text-foreground tracking-tight">
                    {sec.title}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {sec.content}
                  </p>

                  {sec.callout ? (
                    <div
                      className={cn(
                        "rounded-xl border p-4 text-xs leading-relaxed",
                        sec.callout.type === "invariant"
                          ? "border-primary/30 bg-primary/10 text-primary-950 dark:text-primary-200"
                          : sec.callout.type === "warning"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
                            : "border-border/70 bg-muted/40 text-foreground",
                      )}
                    >
                      <span className="font-bold uppercase tracking-wider text-[10px] block mb-1">
                        Architectural Invariant
                      </span>
                      <p>{sec.callout.text}</p>
                    </div>
                  ) : null}

                  {sec.codeSnippet ? (
                    <div className="relative rounded-xl border border-border/80 bg-zinc-950 shadow-inner overflow-hidden">
                      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-2.5 text-xs font-mono text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Code2 className="size-3.5 text-primary" />
                          <span>{sec.language || "typescript"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(sec.codeSnippet!)}
                          className="flex items-center gap-1 hover:text-white transition-colors"
                        >
                          <Copy className="size-3" />
                          <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                        </button>
                      </div>
                      <pre className="p-4 sm:p-5 font-mono text-xs text-zinc-100 overflow-x-auto leading-relaxed no-scrollbar">
                        {sec.codeSnippet}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))}

              {/* Key Invariants Checklist */}
              {concept.docs.keyInvariants.length > 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-6 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldAlert className="size-4" />
                    <span>Non-Negotiable System Invariants</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-foreground/90">
                    {concept.docs.keyInvariants.map((inv, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          #{idx + 1}
                        </span>
                        <span>{inv}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Common Pitfalls Table */}
              {concept.docs.commonPitfalls.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <h4 className="text-lg font-bold text-foreground">
                    Common Pitfalls & Architectural Corrections
                  </h4>
                  <div className="space-y-3">
                    {concept.docs.commonPitfalls.map((pitfall, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-2 text-xs shadow-2xs"
                      >
                        <div className="flex items-start gap-2 text-destructive">
                          <span className="font-bold shrink-0">Mistake:</span>
                          <span>{pitfall.mistake}</span>
                        </div>
                        <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
                          <span className="font-bold shrink-0">Correction:</span>
                          <span>{pitfall.correction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Best Practices */}
              {concept.docs.bestPractices.length > 0 ? (
                <div className="rounded-xl border border-border/70 bg-card p-5 sm:p-6 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Production Best Practices
                  </h4>
                  <div className="space-y-2 text-xs text-foreground/90">
                    {concept.docs.bestPractices.map((bp, i) => (
                      <p key={i} className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-primary" />
                        <span>{bp}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* -------------------------------------------------------------------------- */}
              {/*        DEDICATED END OF DOCUMENTATION CARD WITH TAKE QUIZ BUTTON           */}
              {/* -------------------------------------------------------------------------- */}
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-emerald-500/10 p-6 sm:p-8 text-center space-y-4 shadow-lg">
                <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-7" />
                </div>
                <div className="space-y-1.5 max-w-lg mx-auto">
                  <h4 className="text-xl font-bold text-foreground tracking-tight">
                    End of Courseware Documentation Reached
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You have successfully scrolled and reviewed the documentation, code mental models, and invariants for <strong>{concept.name}</strong>.
                  </p>
                </div>

                {/* The "Take Concept Quiz Now" button directly at the end of documentation! */}
                {hasReached70Percent ? (
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => {
                        handleCompleteStudy();
                        onClose();
                        onLaunchQuiz(concept);
                      }}
                      className="gap-2 font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md px-6 py-2.5 animate-in zoom-in-95"
                    >
                      <HelpCircle className="size-4" />
                      <span>Take Concept Quiz Now</span>
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                    Coverage is currently {docsCoverage}%. Review the code snippets above to reach 70% coverage and unlock the quiz.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* -------------------------------------------------------------------------- */
          /*                              SLIDES VIEW                                   */
          /* -------------------------------------------------------------------------- */
          <div className="h-full flex flex-col justify-between max-w-5xl mx-auto p-5 sm:p-8 overflow-y-auto no-scrollbar">
            <div className="space-y-6 animate-in fade-in duration-200" key={currentSlide.id}>
              {/* Slide Header Indicator */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 font-mono text-xs font-bold">
                    Slide {currentSlideIdx + 1} of {totalSlides}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    · {currentSlide.role}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Press [←] / [→] arrow keys to navigate
                </span>
              </div>

              {/* Slide Title */}
              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {currentSlide.title}
                </h3>
                {currentSlide.subtitle ? (
                  <p className="text-xs sm:text-sm text-primary font-medium mt-1">
                    {currentSlide.subtitle}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {currentSlide.summary}
                </p>
              </div>

              {/* Key Points */}
              {currentSlide.keyPoints && currentSlide.keyPoints.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {currentSlide.keyPoints.map((pt, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/80 bg-card/70 p-4 text-xs text-foreground/90 flex items-start gap-2.5 shadow-2xs"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{pt}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Architecture Diagram Visualization */}
              {currentSlide.diagramData ? (
                <div className="rounded-xl border border-border/80 bg-zinc-950/90 p-5 shadow-inner space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Architectural Component Flow
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {currentSlide.diagramData.nodes.map((node) => (
                      <div
                        key={node.id}
                        className="rounded-lg border border-zinc-700 bg-zinc-900/90 p-3 space-y-1 text-zinc-100 shadow-xs"
                      >
                        <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                          {node.type ?? "Component"}
                        </span>
                        <p className="font-bold text-xs">{node.label}</p>
                        <p className="text-[11px] text-zinc-400">{node.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Code Walkthrough Block */}
              {currentSlide.codeSnippet ? (
                <div className="relative rounded-xl border border-border/80 bg-zinc-950 shadow-inner overflow-hidden">
                  <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-2.5 text-xs font-mono text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Code2 className="size-3.5 text-primary" />
                      <span>{currentSlide.language || "typescript"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentSlide.codeSnippet!)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <Copy className="size-3" />
                      <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                  <pre className="p-4 sm:p-5 font-mono text-xs text-zinc-100 overflow-x-auto leading-relaxed no-scrollbar max-h-64">
                    {currentSlide.codeSnippet}
                  </pre>
                </div>
              ) : null}

              {/* Comparison Table */}
              {currentSlide.comparisonTable ? (
                <div className="overflow-x-auto rounded-xl border border-border/80 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/70 text-foreground font-semibold">
                      <tr>
                        {currentSlide.comparisonTable.headers.map((h, i) => (
                          <th key={i} className="p-3 border-b border-border/70">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {currentSlide.comparisonTable.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-muted/30">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-3 text-muted-foreground">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {/* Slide Takeaway Card */}
              {currentSlide.takeaway ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-primary leading-relaxed flex items-center gap-2.5">
                  <Sparkles className="size-4 shrink-0" />
                  <span>
                    <strong>Takeaway:</strong> {currentSlide.takeaway}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Slide Navigator Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-border/60 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentSlideIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentSlideIdx === 0}
                className="gap-1.5 text-xs font-semibold"
              >
                <ChevronLeft className="size-4" />
                <span>Previous Slide</span>
              </Button>

              {/* Slide Dots */}
              <div className="flex items-center gap-1.5">
                {concept.slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentSlideIdx(idx);
                      const percent = Math.round(((idx + 1) / totalSlides) * 100);
                      setSlidesCoverage((c) => Math.max(c, percent));
                    }}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      idx === currentSlideIdx
                        ? "w-6 bg-primary"
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                    )}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextSlide}
                disabled={currentSlideIdx === totalSlides - 1}
                className="gap-1.5 text-xs font-semibold"
              >
                <span>Next Slide</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------------- */}
      {/*             ACTION FOOTER BAR (ANTI-SPEEDRUN GATING ENFORCED)              */}
      {/* -------------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-card/95 px-6 py-3.5 shrink-0 shadow-sm backdrop-blur-md">
        
        {/* Left: Anti-Speedrun Progress Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border",
                hasReached70Percent
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
              )}
            >
              {hasReached70Percent ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Lock className="size-3.5 text-amber-500" />}
              <span>
                {hasReached70Percent
                  ? "70% Requirement Met ✓"
                  : `Anti-Speedrun: ${maxOverallCoverage}% / 70% Required`}
              </span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <div className="w-28 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  hasReached70Percent ? "bg-emerald-500" : "bg-amber-500",
                )}
                style={{ width: `${Math.min(100, maxOverallCoverage)}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {maxOverallCoverage}%
            </span>
          </div>
        </div>

        {/* Right: Gated Action Buttons */}
        <div className="flex items-center gap-2.5">
          {!hasReached70Percent ? (
            /* Locked state: user must scroll and review to at least 70% */
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="size-3.5 text-amber-500" />
              <span>Cover at least 70% of docs & code to unlock completion</span>
            </span>
          ) : (
            /* Unlocked state: 70% reached! Reveal "Done" and optionally "Take Concept Quiz" */
            <>
              {/* "Take Concept Quiz Now" button only shown when end of docs reached or on final slide */}
              {canShowTakeQuizButton ? (
                <Button
                  type="button"
                  onClick={() => {
                    handleCompleteStudy();
                    onClose();
                    onLaunchQuiz(concept);
                  }}
                  className="gap-2 text-xs font-bold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground animate-in zoom-in-95"
                >
                  <HelpCircle className="size-3.5" />
                  <span>Take Concept Quiz Now</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : null}

              {/* "Done" button appears after 70% covered */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  handleCompleteStudy();
                  onClose();
                }}
                className="gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>Done</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
