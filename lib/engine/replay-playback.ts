export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export function isReplaySpeed(value: number): value is ReplaySpeed {
  return (REPLAY_SPEEDS as readonly number[]).includes(value);
}

export function advancePlayhead(input: {
  timeMs: number;
  elapsedMs: number;
  speed: number;
  durationMs: number;
}): number {
  if (input.elapsedMs <= 0 || input.speed <= 0) return input.timeMs;
  return Math.min(input.durationMs, input.timeMs + input.elapsedMs * input.speed);
}

export function stepFrame(index: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  return Math.max(-1, Math.min(count - 1, index + delta));
}

export function frameIndexAtTime(frames: readonly { t: number }[], timeMs: number): number {
  let index = -1;
  for (let cursor = 0; cursor < frames.length; cursor += 1) {
    if (frames[cursor]!.t <= timeMs) index = cursor;
    else break;
  }
  return index;
}

export function formatReplayTime(ms: number): string {
  const clamped = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}
