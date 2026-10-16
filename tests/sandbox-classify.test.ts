import { describe, expect, it } from "vitest";

import { classifyRun } from "@/sandbox/classify";
import { gradeOutput } from "@/sandbox/grade";
import type { RunResult } from "@/sandbox/types";

const base = {
  stdout: "",
  stderr: "",
  exitCode: 0,
  timedOut: false,
  oomKilled: false,
  outputCapped: false,
  cpuLimitLikely: false,
};

describe("classifyRun", () => {
  it("treats a clean exit as ok", () => {
    expect(classifyRun(base).outcome).toBe("ok");
  });

  it("prefers the output cap over a later timeout", () => {
    expect(classifyRun({ ...base, outputCapped: true, timedOut: true }).outcome).toBe(
      "output_limit",
    );
  });

  it("classifies a wall-clock kill as timeout before an exit 137", () => {
    expect(classifyRun({ ...base, timedOut: true, exitCode: 137 }).outcome).toBe("timeout");
  });

  it("classifies the kernel oom flag as memory_limit", () => {
    expect(classifyRun({ ...base, oomKilled: true, exitCode: 137 }).outcome).toBe("memory_limit");
  });

  it("classifies allocator failures as memory_limit", () => {
    expect(classifyRun({ ...base, exitCode: 134, stderr: "JavaScript heap out of memory" }).outcome).toBe(
      "memory_limit",
    );
  });

  it("classifies the compiler wrapper exit as compile_error", () => {
    expect(classifyRun({ ...base, exitCode: 65, stderr: "error: expected ';'" }).outcome).toBe(
      "compile_error",
    );
  });

  it("classifies a short pid-limit kill as blocked_operation", () => {
    expect(classifyRun({ ...base, exitCode: 137, cpuLimitLikely: false }).outcome).toBe(
      "blocked_operation",
    );
  });

  it("classifies a cpu-limit kill as timeout", () => {
    expect(classifyRun({ ...base, exitCode: 137, cpuLimitLikely: true }).outcome).toBe("timeout");
    expect(classifyRun({ ...base, exitCode: 152 }).outcome).toBe("timeout");
  });

  it("classifies a read-only write as blocked_operation", () => {
    expect(
      classifyRun({ ...base, exitCode: 1, stderr: "open /etc/portal: Read-only file system" }).outcome,
    ).toBe("blocked_operation");
  });

  it("classifies a native-thread limit as blocked_operation", () => {
    expect(
      classifyRun({
        ...base,
        exitCode: 1,
        stderr: "java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached",
      }).outcome,
    ).toBe("blocked_operation");
  });

  it("classifies a process-limit failure as blocked_operation", () => {
    expect(
      classifyRun({
        ...base,
        exitCode: 1,
        stderr: "posix_spawn failed, error: 11 (Resource temporarily unavailable)",
      }).outcome,
    ).toBe("blocked_operation");
  });

  it("classifies an unreachable network as blocked_operation", () => {
    expect(
      classifyRun({ ...base, exitCode: 1, stderr: "connect ENETUNREACH 1.2.3.4:80" }).outcome,
    ).toBe("blocked_operation");
  });

  it("classifies other non-zero exits as runtime_error", () => {
    expect(classifyRun({ ...base, exitCode: 1, stderr: "Error: nope" }).outcome).toBe("runtime_error");
  });
});

describe("gradeOutput", () => {
  const finished: RunResult = {
    outcome: "ok",
    stdout: "6\n",
    stderr: "",
    exitCode: 0,
    timedOut: false,
    durationMs: 12,
    message: "The program finished.",
  };

  it("keeps ok when stdout matches", () => {
    expect(gradeOutput(finished, "6\n").outcome).toBe("ok");
  });

  it("marks a mismatch without copying the expected output", () => {
    const graded = gradeOutput(finished, "HIDDEN_EXPECTED_99\n");
    expect(graded.outcome).toBe("wrong_answer");
    expect(JSON.stringify(graded)).not.toContain("HIDDEN_EXPECTED_99");
  });

  it("leaves a timeout unchanged", () => {
    const timed = { ...finished, outcome: "timeout" as const };
    expect(gradeOutput(timed, "6\n").outcome).toBe("timeout");
  });
});
