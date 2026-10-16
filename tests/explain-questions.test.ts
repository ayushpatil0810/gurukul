import { describe, expect, it } from "vitest";
import {
  generateExplainQuestions,
  gradeExplainAnswer,
  questionsFromUntrusted,
  type ExplainDraft,
} from "@/lib/engine/explain-questions";
import type { RunResult, SandboxRunner, SubmissionLanguage } from "@/sandbox/types";

const js = `function total(n) {
  if (n <= 1) return n;
  return n + 1;
}`;

function result(stdout: string, outcome: RunResult["outcome"] = "ok"): RunResult {
  return {
    outcome,
    stdout,
    stderr: "",
    exitCode: outcome === "ok" ? 0 : 1,
    timedOut: false,
    durationMs: 1,
    message: outcome,
  };
}

function runner(fail = false): SandboxRunner {
  return {
    async run(language: SubmissionLanguage, code: string) {
      if (fail) throw new Error("runner down");
      if (language === "javascript" && code.includes("__explain_probe")) {
        if (code.includes("total(0)")) return result("0\n");
        if (code.includes("<=")) return result("3\n");
        if (code.includes("n < 1")) return result("4\n");
        return result("3\n");
      }
      if (language === "java" || language === "cpp") return result("4\n");
      return result("", "runtime_error");
    },
  };
}

function draft(prompt: string, expected: string): ExplainDraft {
  return {
    type: "trace",
    prompt,
    startLine: 1,
    endLine: 1,
    quote: "return n;",
    grounded: true,
    execution: true,
    grader: { method: "sandbox", expected, tokens: [], literal: null },
  };
}

describe("explain questions", () => {
  it("builds grounded javascript questions from the submitted lines and recorded runs", async () => {
    const generated = await generateExplainQuestions({ code: js, language: "javascript", runner: runner() });
    expect(generated.questions.length).toBeGreaterThanOrEqual(2);
    expect(generated.questions.length).toBeLessThanOrEqual(3);
    expect(new Set(generated.questions.map((question) => question.type)).size).toBeGreaterThan(1);
    for (const question of generated.questions) {
      expect(question.grounded).toBe(true);
      expect(question.quote.length).toBeGreaterThan(0);
      expect(question.startLine).toBeGreaterThan(0);
      expect(question.prompt.toLowerCase()).not.toContain("reference solution");
      expect(question.prompt.toLowerCase()).not.toContain("hidden test");
      if (question.grader.expected) expect(question.prompt).not.toContain(`answer is ${question.grader.expected}`);
    }
    const trace = generated.questions.find((question) => question.type === "trace");
    expect(trace?.grader.expected).toBe("3");
    expect(trace?.prompt).toContain("total(2)");
  });

  it("asks java and c++ questions from program output and a cited line", async () => {
    const java = await generateExplainQuestions({
      code: "public class Main {\n  public static void main(String[] args) {\n    System.out.println(4);\n  }\n}\n",
      language: "java",
      runner: runner(),
    });
    const cpp = await generateExplainQuestions({
      code: "#include <iostream>\nint main() {\n  std::cout << 4;\n}\n",
      language: "cpp",
      runner: runner(),
    });
    expect(java.questions.some((question) => question.type === "trace" && question.grader.expected === "4")).toBe(true);
    expect(cpp.questions.some((question) => question.type === "trace" && question.grader.expected === "4")).toBe(true);
    expect(java.questions.every((question) => question.quote.length > 0)).toBe(true);
    expect(cpp.questions.every((question) => question.quote.length > 0)).toBe(true);
  });

  it("falls back when a run fails and does not invent questions for unstructured code", async () => {
    const reasoned = await generateExplainQuestions({ code: js, language: "javascript", runner: runner(true) });
    expect(reasoned.questions.length).toBeGreaterThanOrEqual(2);
    expect(reasoned.questions.every((question) => question.execution === false)).toBe(true);
    const empty = await generateExplainQuestions({ code: "const value = 1;\n", language: "javascript", runner: runner(true) });
    expect(empty.questions).toEqual([]);
    expect(empty.note).toContain("No generic questions");
  });

  it("rejects malformed model output and keeps the deterministic questions", async () => {
    const fallback = (await generateExplainQuestions({ code: js, language: "javascript", runner: runner() })).questions;
    expect(questionsFromUntrusted({ nope: true }, fallback)).toEqual(fallback.slice(0, 3));
    const leaked = draft("The answer is 4", "4");
    const other = draft("What does total(2) return?", "3");
    expect(questionsFromUntrusted([leaked, other], fallback).map((question) => question.prompt)).toEqual(
      fallback.slice(0, 3).map((question) => question.prompt),
    );
    const accepted = [draft("What does total(2) return?", "3"), draft("What does total(0) return?", "0")];
    expect(questionsFromUntrusted(accepted, fallback)).toHaveLength(2);
  });

  it("scores concise answers and withholds a verdict when the cited line has no checkable fact", () => {
    const sandbox = draft("What does total(2) return?", "3").grader;
    const line = { grader: sandbox, quote: "return n + 1;", startLine: 3 };
    expect(gradeExplainAnswer(line, "3").verdict).toBe("yes");
    expect(gradeExplainAnswer(line, "the result is 3").verdict).toBe("yes");
    expect(gradeExplainAnswer(line, "3 and 9").verdict).toBe("partial");
    expect(gradeExplainAnswer(line, "14").verdict).toBe("no");
    expect(gradeExplainAnswer(line, "").verdict).toBe("no");

    const facts = {
      grader: { method: "facts" as const, expected: null, tokens: ["n"], literal: "1" },
      quote: "return n + 1;",
      startLine: 3,
    };
    expect(gradeExplainAnswer(facts, "n and 1").verdict).toBe("yes");
    expect(gradeExplainAnswer(facts, "n").verdict).toBe("partial");
    expect(gradeExplainAnswer(facts, "because it is longer and more detailed").verdict).toBe("no");
    const thin = gradeExplainAnswer(
      { grader: { method: "facts", expected: null, tokens: [], literal: null }, quote: "return n;", startLine: 2 },
      "n",
    );
    expect(thin.verdict).toBeNull();
    expect(thin.reviewStatus).toBe("needs_review");
  });
});
