import type { SubmissionLanguage } from "@/db/schema/portal";

export type { SubmissionLanguage };

export const RUN_OUTCOMES = [
  "ok",
  "wrong_answer",
  "timeout",
  "memory_limit",
  "runtime_error",
  "compile_error",
  "output_limit",
  "blocked_operation",
] as const;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export type RunLimits = {
  cpuSeconds: number;
  wallSeconds: number;
  memoryMb: number;
  pids: number;
  outputBytes: number;
  tmpfsMb: number;
};

export const DEFAULT_LIMITS: RunLimits = {
  cpuSeconds: 2,
  wallSeconds: 5,
  memoryMb: 256,
  pids: 64,
  outputBytes: 64 * 1024,
  tmpfsMb: 16,
};

export type RunResult = {
  outcome: RunOutcome;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  message: string;
};

export type ContainerFacts = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  oomKilled: boolean;
  outputCapped: boolean;
  /** Exit 137 after about cpuSeconds of work, rather than an immediate pid-limit kill. */
  cpuLimitLikely: boolean;
};

export interface SandboxRunner {
  run(
    language: SubmissionLanguage,
    code: string,
    stdin: string,
    limits?: Partial<RunLimits>,
  ): Promise<RunResult>;
}

export function resolveLimits(overrides?: Partial<RunLimits>): RunLimits {
  const merged = { ...DEFAULT_LIMITS, ...overrides };
  return {
    cpuSeconds: clamp(merged.cpuSeconds, 1, 30, DEFAULT_LIMITS.cpuSeconds),
    wallSeconds: clamp(merged.wallSeconds, 1, 30, DEFAULT_LIMITS.wallSeconds),
    memoryMb: clamp(merged.memoryMb, 32, 512, DEFAULT_LIMITS.memoryMb),
    pids: clamp(merged.pids, 16, 256, DEFAULT_LIMITS.pids),
    outputBytes: clamp(merged.outputBytes, 256, 256 * 1024, DEFAULT_LIMITS.outputBytes),
    tmpfsMb: clamp(merged.tmpfsMb, 4, 64, DEFAULT_LIMITS.tmpfsMb),
  };
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
