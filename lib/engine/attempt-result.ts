import type { RunOutcome } from "@/sandbox/types";

export type VisibleTestResult = {
  id: string;
  passed: boolean;
  outcome: RunOutcome;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  message: string;
};

export type HiddenTestResult = {
  id: string;
  passed: boolean;
  category: RunOutcome;
  message: string;
};

export function toVisibleResults(
  tests: readonly {
    id: string;
    outcome: RunOutcome;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
    message: string;
  }[],
): VisibleTestResult[] {
  return tests.map((test) => ({
    id: test.id,
    passed: test.outcome === "ok",
    outcome: test.outcome,
    stdout: test.stdout,
    stderr: test.stderr,
    exitCode: test.exitCode,
    durationMs: test.durationMs,
    message: test.message,
  }));
}

/** Hidden results carry a category and a message. Inputs, expected output, and program output stay out. */
export function toHiddenResults(
  tests: readonly { id: string; outcome: RunOutcome; message: string }[],
): { passed: number; total: number; passRate: number; tests: HiddenTestResult[] } {
  const hidden = tests.map((test) => ({
    id: test.id,
    passed: test.outcome === "ok",
    category: test.outcome,
    message: test.message,
  }));
  const passed = hidden.filter((test) => test.passed).length;
  return {
    passed,
    total: hidden.length,
    passRate: hidden.length === 0 ? 0 : passed / hidden.length,
    tests: hidden,
  };
}
