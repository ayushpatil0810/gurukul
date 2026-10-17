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
  stderr?: string;
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

/** Hidden results carry a category and a message, and error diagnostics if the program failed to compile or crashed. */
export function toHiddenResults(
  tests: readonly { id: string; outcome: RunOutcome; message: string; stderr?: string }[],
): {
  passed: number;
  total: number;
  passRate: number;
  compilationError?: string;
  runtimeError?: string;
  tests: HiddenTestResult[];
} {
  const hidden = tests.map((test) => {
    const item: HiddenTestResult = {
      id: test.id,
      passed: test.outcome === "ok",
      category: test.outcome,
      message: test.message,
    };
    if (test.stderr && test.outcome !== "ok") {
      item.stderr = test.stderr;
    }
    return item;
  });

  const passed = hidden.filter((test) => test.passed).length;

  // Extract first compilation or runtime error if present
  const firstCompileErr = tests.find((t) => t.outcome === "compile_error" && t.stderr)?.stderr;
  const firstRuntimeErr = tests.find((t) => t.outcome === "runtime_error" && t.stderr)?.stderr;

  const result: {
    passed: number;
    total: number;
    passRate: number;
    compilationError?: string;
    runtimeError?: string;
    tests: HiddenTestResult[];
  } = {
    passed,
    total: hidden.length,
    passRate: hidden.length === 0 ? 0 : passed / hidden.length,
    tests: hidden,
  };

  if (firstCompileErr) {
    result.compilationError = firstCompileErr;
  }
  if (firstRuntimeErr) {
    result.runtimeError = firstRuntimeErr;
  }

  return result;
}

