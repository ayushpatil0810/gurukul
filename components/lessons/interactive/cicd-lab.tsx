"use client";

import { useState } from "react";

export type PipelineStage = {
  id: string;
  name: string;
  status: "idle" | "running" | "passed" | "failed" | "blocked";
  duration?: string;
  logs: string[];
};

const initialStages: PipelineStage[] = [
  {
    id: "stage-1",
    name: "1. Source Trigger",
    status: "idle",
    duration: "1.2s",
    logs: [
      "Webhook triggered by commit 84a92c1 to main",
      "Author: ada@techsummit.example",
      "Cloning repository into runner container...",
      "Repository checkout complete",
    ],
  },
  {
    id: "stage-2",
    name: "2. Lint & Format",
    status: "idle",
    duration: "4.8s",
    logs: [
      "Running ESLint 9.x across 42 files...",
      "Running Prettier formatting check...",
      "0 syntax errors, 0 lint warnings",
    ],
  },
  {
    id: "stage-3",
    name: "3. Automated Tests",
    status: "idle",
    duration: "12.4s",
    logs: [
      "Executing Jest unit and integration test suite...",
      "Running 18 test suites...",
      "Test Results: 64 passed, 0 failed, 100% assertions satisfied",
    ],
  },
  {
    id: "stage-4",
    name: "4. Container Build",
    status: "idle",
    duration: "18.1s",
    logs: [
      "Starting multi-stage Docker build...",
      "Layer caching hit for base image node:20-alpine",
      "Pushing image to registry.company.internal/web:sha-84a92c1",
      "Vulnerability scan: 0 critical vulnerabilities detected",
    ],
  },
  {
    id: "stage-5",
    name: "5. Staging Deploy",
    status: "idle",
    duration: "6.3s",
    logs: [
      "Deploying to Kubernetes staging cluster namespace 'qa'...",
      "Applying Deployment manifests...",
      "Rolling update finished with 2/2 pods ready",
      "Executing smoke tests on staging endpoint... HTTP 200 OK",
    ],
  },
  {
    id: "stage-6",
    name: "6. Production Canary",
    status: "idle",
    duration: "10.0s",
    logs: [
      "Promoting deployment to production cluster...",
      "Routing 10% canary traffic via Service mesh...",
      "Error budget stable: 0.00% 5xx errors observed over 60s",
      "Canary promoted to 100% stable traffic. Deployment complete!",
    ],
  },
];

export function CicdLab({
  onPipelineRun,
}: {
  onPipelineRun?: (stage: number, stageName: string, passed: boolean, gateOutcome: "proceed" | "blocked") => void;
} = {}) {
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [selectedStageId, setSelectedStageId] = useState<string>("stage-3");
  const [scenario, setScenario] = useState<"idle" | "running_success" | "running_failure" | "complete_success" | "complete_failure">("idle");

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? stages[0];

  function runPipeline(hasFailure: boolean) {
    setScenario(hasFailure ? "running_failure" : "running_success");
    // Deterministic stage simulation
    if (!hasFailure) {
      setStages((prev) =>
        prev.map((stage) => ({
          ...stage,
          status: "passed",
        }))
      );
      setScenario("complete_success");
      onPipelineRun?.(6, "Production Deploy Gate", true, "proceed");
    } else {
      setStages((prev) =>
        prev.map((stage) => {
          if (stage.id === "stage-1" || stage.id === "stage-2") {
            return { ...stage, status: "passed" };
          }
          if (stage.id === "stage-3") {
            return {
              ...stage,
              status: "failed",
              logs: [
                "Executing Jest unit and integration test suite...",
                "Running 18 test suites...",
                "FAIL tests/auth.spec.ts: Token verification rejected unauthorized payload",
                "  Expected: 200 OK",
                "  Received: 500 Internal Server Error",
                "ERROR: Test suite failed with exit code 1",
              ],
            };
          }
          // Downstream stages blocked
          return {
            ...stage,
            status: "blocked",
            logs: [
              "BLOCKED: Automated test gate failed.",
              "Deployment cancelled to prevent shipping defects to production.",
            ],
          };
        })
      );
      setSelectedStageId("stage-3");
      setScenario("complete_failure");
      onPipelineRun?.(3, "Automated Tests Gate", false, "blocked");
    }
  }

  function handleReset() {
    setStages(initialStages);
    setScenario("idle");
    setSelectedStageId("stage-3");
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm tracking-tight">
              Visual CI/CD Automation Pipeline
            </h3>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
              Simulated Pipeline
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Watch code flow through automated gates and inspect stage failure handling.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          Reset Pipeline
        </button>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runPipeline(false)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          ▶ Run Pipeline (Happy Path)
        </button>
        <button
          type="button"
          onClick={() => runPipeline(true)}
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
        >
          ⚠ Simulate Automated Test Failure Gate
        </button>
      </div>

      {/* Status Alert Banner */}
      {scenario === "complete_failure" ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">
          <span className="font-semibold">Pipeline Blocked: </span>
          Stage 3 (Automated Tests) failed. Downstream deployment stages 4, 5, and 6 were immediately aborted to protect production stability.
        </div>
      ) : scenario === "complete_success" ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
          <span className="font-semibold">Pipeline Succeeded: </span>
          All 6 stages passed automated verification. Production canary was safely promoted.
        </div>
      ) : null}

      {/* Visual Pipeline Stages */}
      <div className="grid gap-2 sm:grid-cols-6">
        {stages.map((stage) => {
          const isSelected = selectedStage?.id === stage.id;
          const statusStyle =
            stage.status === "passed"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : stage.status === "failed"
                ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 animate-pulse"
                : stage.status === "blocked"
                  ? "border-border/50 bg-muted/30 text-muted-foreground opacity-60"
                  : "border-border bg-card text-foreground";

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setSelectedStageId(stage.id)}
              className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${statusStyle} ${
                isSelected ? "ring-2 ring-primary" : "hover:border-foreground/40"
              }`}
              aria-label={`Inspect ${stage.name}`}
            >
              <span className="text-[11px] font-semibold truncate w-full">{stage.name}</span>
              <div className="mt-2 flex w-full items-center justify-between text-[10px]">
                <span className="capitalize font-mono">{stage.status}</span>
                <span className="text-muted-foreground">{stage.duration}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Stage Detail Inspector */}
      {selectedStage ? (
        <div className="rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-300 dark:bg-black">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
            <span>Stage Inspector: {selectedStage.name}</span>
            <span className="capitalize text-zinc-200">Status: {selectedStage.status}</span>
          </div>
          <div className="mt-2 max-h-28 overflow-y-auto space-y-1 text-[11px]">
            {selectedStage.logs.map((log, idx) => (
              <div
                key={idx}
                className={
                  log.includes("FAIL") || log.includes("ERROR")
                    ? "text-red-400 font-semibold"
                    : log.includes("BLOCKED")
                      ? "text-amber-400"
                      : log.includes("passed") || log.includes("complete")
                        ? "text-emerald-400"
                        : "text-zinc-400"
                }
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
