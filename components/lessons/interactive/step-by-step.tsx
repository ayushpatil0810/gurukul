"use client";

import { useEffect, useState } from "react";
import type { StepByStepData } from "@/lib/engine/lesson-preview";

export function StepByStepViewer({
  data,
  onStepChange,
}: {
  data: StepByStepData;
  onStepChange?: (stepIndex: number, totalSteps: number, completed: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const steps = data.steps;
  const activeStep = steps[currentStep];

  function changeStep(nextIndex: number) {
    const bounded = Math.max(0, Math.min(steps.length - 1, nextIndex));
    setCurrentStep(bounded);
    onStepChange?.(bounded, steps.length, bounded === steps.length - 1);
  }

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        onStepChange?.(next, steps.length, next === steps.length - 1);
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isPlaying, steps.length, onStepChange]);

  if (!activeStep) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm tracking-tight">
            {data.title ?? "Interactive Step-by-Step Sequence"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Step {currentStep + 1} of {steps.length}: {activeStep.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? "Pause automated playback" : "Play automated step progression"}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              changeStep(0);
            }}
            aria-label="Reset to step 1"
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="grid grid-cols-1 gap-1">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Steps">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={idx === currentStep}
              aria-label={`Step ${idx + 1}: ${step.title}`}
              onClick={() => {
                setIsPlaying(false);
                changeStep(idx);
              }}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? "bg-primary ring-2 ring-primary/30"
                  : idx < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Active Step Content */}
      <div
        key={activeStep.id}
        className="rounded-lg border border-border/70 bg-background/60 p-4 space-y-3 transition-all duration-200 motion-reduce:transition-none"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
            {currentStep + 1}
          </span>
          <h4 className="font-semibold text-foreground text-sm">{activeStep.title}</h4>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {activeStep.explanation}
        </p>

        {activeStep.callout ? (
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
            <span className="font-semibold">Key Insight: </span>
            {activeStep.callout}
          </div>
        ) : null}

        {activeStep.diagramHighlightNodeIds && activeStep.diagramHighlightNodeIds.length > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Relevant components:</span>
            {activeStep.diagramHighlightNodeIds.map((id) => (
              <span
                key={id}
                className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]"
              >
                {id}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Stepping Navigation Controls */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          disabled={currentStep === 0}
          onClick={() => {
            setIsPlaying(false);
            changeStep(currentStep - 1);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
        >
          ← Previous step
        </button>
        <span className="text-xs text-muted-foreground font-mono">
          {currentStep + 1} / {steps.length}
        </span>
        <button
          type="button"
          disabled={currentStep === steps.length - 1}
          onClick={() => {
            setIsPlaying(false);
            changeStep(currentStep + 1);
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          Next step →
        </button>
      </div>
    </div>
  );
}
