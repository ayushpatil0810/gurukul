"use client";

import { memo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { formatReplayTime, REPLAY_SPEEDS } from "@/lib/engine/replay-playback";
import { replayWarning, type ReplayFrame, type ReplaySourceEvent } from "@/lib/engine/replay-timeline";
import { useReplayPlayback } from "@/components/replay/use-replay-playback";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const CodeView = memo(function CodeView({ value }: { value: string }) {
  return (
    <Editor
      height="420px"
      defaultLanguage="javascript"
      theme="vs-dark"
      value={value}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        wordWrap: "on",
      }}
    />
  );
});

export function ReplayPlayer({
  session,
  chainValid,
  events,
  initialTimeMs = 0,
  focus,
}: {
  session: {
    id: string;
    mode: string;
    startedAt: string;
    studentName: string;
    questionStatement: string;
    questionDifficulty: number;
  };
  chainValid: boolean;
  events: ReplaySourceEvent[];
  initialTimeMs?: number;
  focus?: { fromT: number; toT: number } | null;
}) {
  const playback = useReplayPlayback(events, initialTimeMs);
  const regionRef = useRef<HTMLDivElement>(null);
  const actions = useRef(playback);
  useEffect(() => {
    actions.current = playback;
  });
  const moment = playback.moment;
  const frame = playback.frame;
  const warning = !moment.playable && moment.reason ? replayWarning(moment.reason) : null;
  const gapNotice = frame?.detail.gap && !frame.detail.gap.resolved ? frame.detail : null;

  useEffect(() => {
    const node = regionRef.current;
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, select, textarea, button, a")) return;
      if (event.key === " ") {
        event.preventDefault();
        actions.current.toggle();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        actions.current.step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        actions.current.step(1);
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={regionRef}
      tabIndex={0}
      className="space-y-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Session replay"
    >
      {focus ? (
        <div role="status" className="rounded-lg border border-border bg-muted p-4">
          <p className="font-medium">Evidence range</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Opened at {formatReplayTime(focus.fromT)}
            {focus.toT !== focus.fromT ? ` through ${formatReplayTime(focus.toT)}` : ""}. This marks a review signal.
            It is not a conclusion about the student.
          </p>
        </div>
      ) : null}

      <section className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">
          {session.studentName} · {session.mode} · difficulty {session.questionDifficulty}
        </p>
        <h2 className="mt-1 text-lg font-semibold">{session.questionStatement}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Started {session.startedAt.replace("T", " ").slice(0, 19)} UTC ·{" "}
          {chainValid ? "Event chain checks out" : "Event chain does not check out"}
        </p>
      </section>

      {warning ? (
        <div role="status" className="rounded-lg border border-border bg-muted p-4">
          <p className="font-medium">{warning.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{warning.body}</p>
          {frame?.span ? (
            <p className="mt-2 text-sm">
              Affected range {formatReplayTime(frame.span.fromT)}–{formatReplayTime(frame.span.toT)}, sequences{" "}
              {frame.span.fromSeq}–{frame.span.toSeq}. No code is shown for this range.
            </p>
          ) : (
            <p className="mt-2 text-sm">No code is shown for this point. That is different from an empty program.</p>
          )}
        </div>
      ) : null}

      {gapNotice && moment.playable ? (
        <div role="status" className="rounded-lg border border-border p-4">
          <p className="font-medium">A recording gap is marked here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sequences {gapNotice.gap?.missingFrom}–{gapNotice.gap?.missingTo} were not stored. The editor shows only
            the events received before that hole. Nothing is filled in, and this is not a finding about the student.
          </p>
        </div>
      ) : null}

      {moment.playable ? (
        <section className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
            <span>Reconstructed editor</span>
            {moment.text === "" ? <span>The editor is empty at this point.</span> : <span>Read only</span>}
          </div>
          <CodeView value={moment.text ?? ""} />
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-border p-6">
          <p className="font-medium">No code available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The editor is hidden because this point cannot be rebuilt. Use previous and next to inspect a part of the
            recording that can.
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => playback.step(-1)} aria-label="Previous event">
            Previous
          </Button>
          <Button type="button" onClick={playback.toggle} aria-label={playback.playing ? "Pause replay" : "Play replay"}>
            {playback.playing ? "Pause" : "Play"}
          </Button>
          <Button type="button" variant="outline" onClick={() => playback.step(1)} aria-label="Next event">
            Next
          </Button>
          <label className="ml-auto flex items-center gap-2 text-sm">
            Speed
            <select
              aria-label="Playback speed"
              className="rounded-md border border-border bg-background px-2 py-1"
              value={playback.speed}
              onChange={(event) => playback.chooseSpeed(Number(event.target.value))}
            >
              {REPLAY_SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-16 font-mono text-sm tabular-nums">{formatReplayTime(playback.timeMs)}</span>
          <input
            className="h-2 flex-1 accent-current"
            type="range"
            min={0}
            max={Math.max(playback.timeline.durationMs, 1)}
            step={1}
            value={Math.min(playback.timeMs, playback.timeline.durationMs)}
            aria-label="Replay position"
            aria-valuemin={0}
            aria-valuemax={playback.timeline.durationMs}
            aria-valuenow={playback.timeMs}
            aria-valuetext={formatReplayTime(playback.timeMs)}
            onChange={(event) => playback.seek(Number(event.target.value))}
          />
          <span className="w-16 text-right font-mono text-sm tabular-nums">
            {formatReplayTime(playback.timeline.durationMs)}
          </span>
        </div>
        <MarkerTrack frames={playback.timeline.frames} durationMs={playback.timeline.durationMs} onSelect={playback.selectFrame} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <EventList frames={playback.timeline.frames} selected={playback.frameIndex} onSelect={playback.selectFrame} />
        <Detail frame={frame} />
      </div>
      <p className="text-xs text-muted-foreground">
        Click the replay, then use Space to play or pause and the arrow keys to move one event. The slider also moves
        by arrow key when it is focused.
      </p>
    </div>
  );
}

function MarkerTrack({
  frames,
  durationMs,
  onSelect,
}: {
  frames: ReplayFrame[];
  durationMs: number;
  onSelect: (index: number) => void;
}) {
  const markers = frames.filter((frame) => frame.marker);
  if (markers.length === 0) return null;
  return (
    <div className="relative h-8" aria-hidden={false}>
      <p className="sr-only">Event markers</p>
      {markers.map((frame) => {
        const left = durationMs <= 0 ? 0 : (frame.t / durationMs) * 100;
        return (
          <button
            key={`${frame.seq}-${frame.marker}`}
            type="button"
            className="absolute top-0 -translate-x-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase"
            style={{ left: `${Math.min(100, Math.max(0, left))}%` }}
            onClick={() => onSelect(frame.index)}
          >
            {markerLabel(frame.marker!)}
          </button>
        );
      })}
    </div>
  );
}

function markerLabel(marker: NonNullable<ReplayFrame["marker"]>): string {
  if (marker === "edit") return "Edit";
  if (marker === "run") return "Run";
  if (marker === "submit") return "Submit";
  return "Gap";
}

function EventList({
  frames,
  selected,
  onSelect,
}: {
  frames: ReplayFrame[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  if (frames.length === 0) {
    return <p className="text-sm text-muted-foreground">This session has no recorded events.</p>;
  }
  return (
    <ol className="max-h-80 space-y-1 overflow-auto rounded-lg border border-border p-2" aria-label="Recorded events">
      {frames.map((frame) => {
        const current = frame.index === selected;
        return (
          <li key={frame.seq}>
            <button
              type="button"
              className={`flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm ${
                current ? "bg-secondary font-medium" : "hover:bg-muted"
              }`}
              aria-current={current ? "true" : undefined}
              onClick={() => onSelect(frame.index)}
            >
              <span>
                {frame.detail.label}
                {frame.reason && !frame.playable ? " · cannot rebuild" : ""}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatReplayTime(frame.t)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Detail({ frame }: { frame: ReplayFrame | null }) {
  if (!frame) {
    return (
      <aside className="rounded-lg border border-border p-4 text-sm">
        <p className="font-medium">Before the first event</p>
        <p className="mt-2 text-muted-foreground">The editor shows the recorded starting document, when one exists.</p>
      </aside>
    );
  }
  return (
    <aside className="rounded-lg border border-border p-4 text-sm">
      <p className="font-medium">{frame.detail.label}</p>
      <dl className="mt-3 space-y-2">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Time</dt>
          <dd className="font-mono tabular-nums">{formatReplayTime(frame.t)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Sequence</dt>
          <dd className="font-mono">{frame.seq}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Append order</dt>
          <dd className="font-mono">{frame.chainIndex ?? "—"}</dd>
        </div>
        {frame.detail.outcome ? (
          <div>
            <dt className="text-muted-foreground">Outcome</dt>
            <dd className="mt-1">{frame.detail.outcome}</dd>
          </div>
        ) : null}
        {frame.detail.note ? (
          <div>
            <dt className="text-muted-foreground">Note</dt>
            <dd className="mt-1">{frame.detail.note}</dd>
          </div>
        ) : null}
        {frame.detail.gap ? (
          <div>
            <dt className="text-muted-foreground">Missing sequences</dt>
            <dd className="mt-1">
              {frame.detail.gap.missingFrom}–{frame.detail.gap.missingTo}
              {frame.detail.gap.resolved ? " · later events filled this range" : " · still missing"}
            </dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}
