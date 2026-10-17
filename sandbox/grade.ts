import type { RunResult } from "@/sandbox/types";

function normalizeOutput(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
}

/**
 * Compares stdout to the expected sample outside the container.
 * The expected text is never copied into the result.
 */
export function gradeOutput(result: RunResult, expected: string): RunResult {
  if (result.outcome !== "ok") return result;
  if (normalizeOutput(result.stdout) === normalizeOutput(expected)) return result;
  return {
    ...result,
    outcome: "wrong_answer",
    message: "The program output did not match this test.",
  };
}
