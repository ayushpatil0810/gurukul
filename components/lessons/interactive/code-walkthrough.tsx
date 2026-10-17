"use client";

import { useState } from "react";
import type { CodeWalkthroughData } from "@/lib/engine/lesson-preview";

export function CodeWalkthrough({
  data,
  onStepChange,
}: {
  data: CodeWalkthroughData;
  onStepChange?: (stepIndex: number, totalSteps: number) => void;
}) {
  const [activeAnnotationIndex, setActiveAnnotationIndex] = useState(0);
  const annotations = data.annotations;
  const activeAnnotation = annotations[activeAnnotationIndex];

  function handleStep(index: number) {
    setActiveAnnotationIndex(index);
    onStepChange?.(index, annotations.length);
  }

  const codeLines = data.code.split("\n");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm tracking-tight">
            {data.title ?? "Interactive Code Walkthrough"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground font-mono">
            {data.filename ?? `example.${data.language}`} · {annotations.length} guided checkpoints
          </p>
        </div>
        {annotations.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activeAnnotationIndex === 0}
              onClick={() => handleStep(Math.max(0, activeAnnotationIndex - 1))}
              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
              aria-label="Previous code annotation"
            >
              ← Prev
            </button>
            <span className="text-xs font-mono text-muted-foreground px-1">
              {activeAnnotationIndex + 1}/{annotations.length}
            </span>
            <button
              type="button"
              disabled={activeAnnotationIndex === annotations.length - 1}
              onClick={() => handleStep(Math.min(annotations.length - 1, activeAnnotationIndex + 1))}
              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
              aria-label="Next code annotation"
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>

      {/* Code Display Area */}
      <div className="overflow-hidden rounded-lg border border-border bg-zinc-950 font-mono text-xs text-zinc-100 dark:bg-black">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] text-zinc-400">
          <span>{data.filename ?? data.language}</span>
          {activeAnnotation ? (
            <span className="rounded bg-primary/20 text-primary-foreground px-2 py-0.5 text-[10px]">
              Highlighting lines {activeAnnotation.lineStart}–{activeAnnotation.lineEnd}
            </span>
          ) : null}
        </div>
        <div className="max-h-[380px] overflow-auto py-2">
          {codeLines.map((line, idx) => {
            const lineNumber = idx + 1;
            const isHighlighted =
              activeAnnotation &&
              lineNumber >= activeAnnotation.lineStart &&
              lineNumber <= activeAnnotation.lineEnd;

            return (
              <div
                key={`line-${lineNumber}`}
                className={`grid grid-cols-[2.8rem_minmax(0,1fr)] px-3 py-0.5 transition-colors duration-150 ${
                  isHighlighted
                    ? "bg-primary/20 border-l-2 border-primary"
                    : "hover:bg-zinc-900/50"
                }`}
              >
                <span className={`select-none text-right pr-3 font-mono ${
                  isHighlighted ? "text-primary font-bold" : "text-zinc-600"
                }`}>
                  {lineNumber}
                </span>
                <span className="whitespace-pre overflow-x-auto text-zinc-200">
                  {line}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Annotation Card */}
      {activeAnnotation ? (
        <div
          className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-1.5 text-xs animate-in fade-in slide-in-from-bottom-1 duration-150"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeAnnotationIndex + 1}
              </span>
              <h4 className="font-semibold text-foreground text-xs">{activeAnnotation.title}</h4>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              Lines {activeAnnotation.lineStart}–{activeAnnotation.lineEnd}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground pt-1">
            {activeAnnotation.explanation}
          </p>
        </div>
      ) : null}
    </div>
  );
}
