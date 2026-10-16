"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  advancePlayhead,
  frameIndexAtTime,
  isReplaySpeed,
  stepFrame,
  type ReplaySpeed,
} from "@/lib/engine/replay-playback";
import {
  buildReplayTimeline,
  replayDocument,
  type ReplayMoment,
  type ReplaySourceEvent,
  type ReplayTimeline,
} from "@/lib/engine/replay-timeline";

export function useReplayPlayback(events: readonly ReplaySourceEvent[]) {
  const timeline = useMemo(() => buildReplayTimeline(events), [events]);
  const [frameIndex, setFrameIndex] = useState(-1);
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const timeRef = useRef(0);
  const indexRef = useRef(-1);

  function commit(index: number, time: number) {
    indexRef.current = index;
    timeRef.current = time;
    setFrameIndex(index);
    setTimeMs(time);
  }

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = now - last;
      last = now;
      const nextTime = advancePlayhead({
        timeMs: timeRef.current,
        elapsedMs: elapsed,
        speed,
        durationMs: timeline.durationMs,
      });
      const nextIndex = frameIndexAtTime(timeline.frames, nextTime);
      indexRef.current = nextIndex;
      timeRef.current = nextTime;
      setTimeMs(nextTime);
      setFrameIndex(nextIndex);
      if (nextTime >= timeline.durationMs) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, timeline]);

  const moment: ReplayMoment = replayDocument(timeline, frameIndex);

  function play() {
    if (timeline.frames.length === 0) return;
    if (timeline.durationMs === 0 || timeRef.current >= timeline.durationMs) {
      const index = timeline.durationMs === 0 ? timeline.frames.length - 1 : -1;
      commit(index, 0);
      if (timeline.durationMs === 0) return;
    }
    setPlaying(true);
  }

  function pause() {
    setPlaying(false);
  }

  function seek(nextTime: number) {
    const time = Math.max(0, Math.min(timeline.durationMs, nextTime));
    commit(frameIndexAtTime(timeline.frames, time), time);
    setPlaying(false);
  }

  function step(delta: number) {
    setPlaying(false);
    const next = stepFrame(indexRef.current, delta, timeline.frames.length);
    const time = next < 0 ? 0 : timeline.frames[next]!.t;
    commit(next, time);
  }

  function chooseSpeed(value: number) {
    if (isReplaySpeed(value)) setSpeed(value);
  }

  function selectFrame(index: number) {
    step(index - frameIndex);
  }

  return {
    timeline,
    frameIndex,
    timeMs,
    playing,
    speed,
    moment,
    frame: frameIndex < 0 ? null : timeline.frames[frameIndex] ?? null,
    play,
    pause,
    toggle() {
      if (playing) pause();
      else play();
    },
    seek,
    step,
    chooseSpeed,
    selectFrame,
  };
}

export type ReplayPlayback = ReturnType<typeof useReplayPlayback>;
export type { ReplayTimeline };
