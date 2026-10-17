"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  HelpCircle,
  Loader2,
  Play,
  Send,
  Terminal,
  XCircle,
} from "lucide-react";

export type VisibleTestResult = {
  id: string;
  passed: boolean;
  outcome: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  message: string;
};

export type SubmitTestResult = {
  passed: number;
  total: number;
  correct: boolean;
  attemptId: string | null;
  compilationError?: string;
  runtimeError?: string;
  tests: { id: string; passed: boolean; category: string; message: string; stderr?: string }[];
};

interface ConsolePanelProps {
  sampleTests: { id: string; input: string; expectedOutput: string }[];
  visibleResults: VisibleTestResult[] | null;
  submitResult: SubmitTestResult | null;
  isBusy: boolean;
  activeAction: "run" | "submit" | null;
  error: string;
  onRun: () => void;
  onSubmit: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ConsolePanel({
  sampleTests,
  visibleResults,
  submitResult,
  isBusy,
  activeAction,
  error,
  onRun,
  onSubmit,
  isCollapsed,
  onToggleCollapse,
}: ConsolePanelProps) {
  const [activeTab, setActiveTab] = useState<"testcase" | "testresult">("testcase");
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);

  // Auto switch to testresult tab when new results or errors arrive
  useEffect(() => {
    if (visibleResults || submitResult || error) {
      setActiveTab("testresult");
    }
  }, [visibleResults, submitResult, error]);

  const hasResults = Boolean(visibleResults || submitResult || error);

  // Detect any compilation, syntax, or runtime error from run or submit
  const primaryErrorText =
    error ||
    submitResult?.compilationError ||
    submitResult?.runtimeError ||
    submitResult?.tests.find((t) => t.stderr)?.stderr ||
    visibleResults?.find(
      (r) => r.stderr && (r.outcome === "compile_error" || r.outcome === "runtime_error" || !r.passed),
    )?.stderr ||
    null;

  const isSyntaxOrCompileError =
    Boolean(primaryErrorText) &&
    (/SyntaxError/i.test(primaryErrorText ?? "") ||
      /compile_error/i.test(submitResult?.tests[0]?.category ?? "") ||
      /compile/i.test(primaryErrorText ?? "") ||
      /Unexpected token/i.test(primaryErrorText ?? "") ||
      /ReferenceError/i.test(primaryErrorText ?? "") ||
      /TypeError/i.test(primaryErrorText ?? ""));

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 shadow-xs">
      {/* Console Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("testcase");
              if (isCollapsed) onToggleCollapse();
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              activeTab === "testcase" && !isCollapsed
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            <Code2 className="size-3.5 text-zinc-400" />
            <span>Testcase</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("testresult");
              if (isCollapsed) onToggleCollapse();
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              activeTab === "testresult" && !isCollapsed
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            <Terminal className="size-3.5 text-zinc-400" />
            <span>Test Result</span>
            {hasResults ? (
              <span
                className={`size-2 rounded-full ${
                  (submitResult?.correct || visibleResults?.every((r) => r.passed)) && !primaryErrorText
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              />
            ) : null}
          </button>
        </div>

        {/* Collapse / Expand Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand Console" : "Collapse Console"}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <span>Console</span>
          {isCollapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {/* Console Body (Collapsible) */}
      {!isCollapsed ? (
        <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
          {isBusy ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2 text-zinc-400">
              <Loader2 className="size-6 animate-spin text-emerald-400" />
              <p className="text-xs font-mono">
                {activeAction === "submit"
                  ? "Evaluating function block against complete test suite..."
                  : "Compiling and running function block with sample inputs..."}
              </p>
            </div>
          ) : activeTab === "testcase" ? (
            /* Testcase Tab */
            <div className="space-y-3">
              {/* Case Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {sampleTests.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedCaseIndex(idx)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      selectedCaseIndex === idx
                        ? "bg-zinc-800 font-semibold text-zinc-100 shadow-2xs border border-zinc-700"
                        : "bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                    }`}
                  >
                    Case {idx + 1}
                  </button>
                ))}
              </div>

              {/* Selected Case Content */}
              {sampleTests[selectedCaseIndex] ? (
                <div className="space-y-2.5 text-xs font-mono">
                  <div>
                    <span className="text-[11px] text-zinc-400 uppercase tracking-wide">
                      Input Arguments:
                    </span>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-2.5 text-xs text-amber-300 border border-zinc-800">
                      {sampleTests[selectedCaseIndex].input.trim() || "(empty input)"}
                    </pre>
                  </div>

                  <div>
                    <span className="text-[11px] text-zinc-400 uppercase tracking-wide">
                      Expected Return Value:
                    </span>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-2.5 text-xs text-emerald-400 border border-zinc-800">
                      {sampleTests[selectedCaseIndex].expectedOutput.trim()}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No test cases available.</p>
              )}
            </div>
          ) : (
            /* Test Result Tab */
            <div className="space-y-4">
              {/* High-Visibility Execution & Syntax Error Banner */}
              {primaryErrorText ? (
                <div className="overflow-hidden rounded-xl border border-rose-500/40 bg-linear-to-b from-rose-950/40 to-rose-950/20 text-rose-200 shadow-lg">
                  <div className="flex items-center justify-between border-b border-rose-500/30 bg-rose-900/30 px-3.5 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="size-4 text-rose-400 shrink-0" />
                      <span className="font-bold tracking-tight text-rose-300">
                        {isSyntaxOrCompileError ? "Syntax / Compilation Error" : "Execution Runtime Error"}
                      </span>
                    </div>
                    <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-rose-300 border border-rose-500/30">
                      Action Required
                    </span>
                  </div>

                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-start gap-2 text-xs text-rose-200/90">
                      <HelpCircle className="size-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-[11px]">
                        The code encountered an error during parsing or execution. Review the exact error description and stack trace below to fix the syntax error directly in your function body.
                      </p>
                    </div>

                    <pre className="max-h-48 overflow-auto rounded-lg bg-black/80 p-3 font-mono text-[11px] text-rose-300 border border-rose-900/60 whitespace-pre-wrap leading-relaxed selection:bg-rose-900/50">
                      {primaryErrorText}
                    </pre>
                  </div>
                </div>
              ) : null}

              {/* Submit Result View */}
              {submitResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      {submitResult.correct ? (
                        <>
                          <CheckCircle2 className="size-5 text-emerald-400" />
                          <span className="text-base font-bold text-emerald-400">
                            Accepted
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-5 text-rose-400" />
                          <span className="text-base font-bold text-rose-400">
                            {isSyntaxOrCompileError ? "Compile / Syntax Error" : "Wrong Answer"}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-xs font-mono text-zinc-300">
                        {submitResult.passed} / {submitResult.total} Testcases Passed
                      </span>
                    </div>
                  </div>

                  {/* Mode Badge */}
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300 flex items-center justify-between">
                    <span>
                      Mode: <strong className="font-semibold">Practice & Ungraded</strong>. Practice evaluations do not alter your official assessment record.
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400/80">Sandbox Active</span>
                  </div>

                  {/* Test breakdown */}
                  <div className="space-y-1.5 text-xs">
                    {submitResult.tests.map((test, index) => (
                      <div
                        key={test.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-zinc-300">Hidden Test {index + 1}</span>
                        <span
                          className={`font-semibold text-[11px] ${
                            test.passed ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {test.passed ? "Passed" : `${test.category}: ${test.message}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Visible Run Results */}
              {visibleResults && !submitResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      {visibleResults.every((r) => r.passed) ? (
                        <>
                          <CheckCircle2 className="size-5 text-emerald-400" />
                          <span className="text-base font-bold text-emerald-400">
                            Accepted
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-5 text-rose-400" />
                          <span className="text-base font-bold text-rose-400">
                            {isSyntaxOrCompileError ? "Syntax / Compile Error" : "Wrong Answer"}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5 text-zinc-500" />
                        {Math.max(...visibleResults.map((r) => r.durationMs), 0)} ms
                      </span>
                      <span>
                        {visibleResults.filter((r) => r.passed).length} / {visibleResults.length} Passed
                      </span>
                    </div>
                  </div>

                  {/* Case Pill Selectors */}
                  <div className="flex flex-wrap items-center gap-2">
                    {visibleResults.map((res, idx) => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => setSelectedCaseIndex(idx)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors border ${
                          selectedCaseIndex === idx
                            ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                            : "bg-zinc-900/60 text-zinc-400 border-transparent hover:bg-zinc-800/60"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            res.passed ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        <span>Case {idx + 1}</span>
                      </button>
                    ))}
                  </div>

                  {/* Selected Run Details */}
                  {visibleResults[selectedCaseIndex] ? (
                    <div className="space-y-2 text-xs font-mono">
                      {visibleResults[selectedCaseIndex].stdout ? (
                        <div>
                          <span className="text-[11px] text-zinc-400 uppercase tracking-wide">
                            Your Function Output:
                          </span>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-2.5 text-xs text-zinc-200 border border-zinc-800">
                            {visibleResults[selectedCaseIndex].stdout}
                          </pre>
                        </div>
                      ) : null}

                      {sampleTests[selectedCaseIndex] ? (
                        <div>
                          <span className="text-[11px] text-zinc-400 uppercase tracking-wide">
                            Expected Output:
                          </span>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-2.5 text-xs text-emerald-400 border border-zinc-800">
                            {sampleTests[selectedCaseIndex].expectedOutput}
                          </pre>
                        </div>
                      ) : null}

                      {visibleResults[selectedCaseIndex].stderr ? (
                        <div>
                          <span className="text-[11px] text-rose-400 uppercase tracking-wide">
                            Error Output (stderr):
                          </span>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-rose-950/40 p-2.5 text-xs text-rose-300 border border-rose-900/50 whitespace-pre-wrap">
                            {visibleResults[selectedCaseIndex].stderr}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!visibleResults && !submitResult && !primaryErrorText ? (
                <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                  You must run your code first to view execution test results.
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Action Footer (LeetCode Style Run & Submit) */}
      <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/95 px-3.5 py-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          <Terminal className="size-3.5" />
          <span>Console</span>
          {isCollapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        <div className="flex items-center gap-2">
          {/* Run Button (Ctrl + Enter) */}
          <button
            type="button"
            onClick={onRun}
            disabled={isBusy}
            title="Run Code (Ctrl + Enter)"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-colors shadow-xs"
          >
            {isBusy && activeAction === "run" ? (
              <Loader2 className="size-3.5 animate-spin text-zinc-300" />
            ) : (
              <Play className="size-3.5 text-zinc-300 fill-zinc-300" />
            )}
            <span>Run</span>
          </button>

          {/* Submit Button (LeetCode Green) */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy}
            title="Submit Solution to Test Suite"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-xs"
          >
            {isBusy && activeAction === "submit" ? (
              <Loader2 className="size-3.5 animate-spin text-white" />
            ) : (
              <Send className="size-3.5 text-white" />
            )}
            <span>Submit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
