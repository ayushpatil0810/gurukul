import * as React from "react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/20 py-8 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-foreground">LearnLoop</span>
          <span>&bull;</span>
          <span>Adaptive Learning &amp; Assessment Engine</span>
        </div>

        <div className="flex items-center gap-6 text-[11px]">
          <span>Bayesian Knowledge Tracing</span>
          <span>&bull;</span>
          <span>Isolated Linux Sandboxes</span>
          <span>&bull;</span>
          <span>Keystroke Telemetry</span>
        </div>
      </div>
    </footer>
  );
}
