"use client";

import { useReducer } from "react";

export type SimulatedPod = {
  id: string;
  name: string;
  status: "Ready" | "Pending" | "Terminating" | "Unhealthy";
  readyCount: "1/1" | "0/1";
  restarts: number;
  ip: string;
  node: string;
  version: string;
  events: string[];
};

export type K8sClusterState = {
  desiredReplicas: number;
  availableReplicas: number;
  deploymentStatus: "Healthy" | "Degraded" | "Scaling" | "RollingUpdate";
  serviceStatus: "Active" | "Warning";
  pods: SimulatedPod[];
  selectedPodId: string | null;
  activeScenario: "none" | "readiness_probe_failure";
  logs: string[];
};

export type K8sAction =
  | { type: "SET_REPLICAS"; count: number }
  | { type: "SELECT_POD"; podId: string | null }
  | { type: "TRIGGER_FAILURE"; scenario: "readiness_probe_failure" }
  | { type: "APPLY_CORRECTIVE_ACTION" }
  | { type: "TRIGGER_ROLLING_UPDATE" }
  | { type: "RESTART_POD"; podId: string }
  | { type: "RESET" };

export function createInitialK8sState(): K8sClusterState {
  return {
    desiredReplicas: 3,
    availableReplicas: 3,
    deploymentStatus: "Healthy",
    serviceStatus: "Active",
    pods: [
      {
        id: "pod-1",
        name: "web-deploy-74b5c8-v9q1",
        status: "Ready",
        readyCount: "1/1",
        restarts: 0,
        ip: "10.244.1.14",
        node: "node-worker-alpha",
        version: "v1.0.0",
        events: [
          "Successfully assigned default/web-deploy-74b5c8-v9q1 to node-worker-alpha",
          "Container image 'learnloop/web:1.0' already present on machine",
          "Created container web-server",
          "Started container web-server",
          "Readiness probe passed (HTTP 200 on :8080/healthz)",
        ],
      },
      {
        id: "pod-2",
        name: "web-deploy-74b5c8-k4l2",
        status: "Ready",
        readyCount: "1/1",
        restarts: 0,
        ip: "10.244.2.22",
        node: "node-worker-beta",
        version: "v1.0.0",
        events: [
          "Successfully assigned default/web-deploy-74b5c8-k4l2 to node-worker-beta",
          "Container image 'learnloop/web:1.0' already present on machine",
          "Created container web-server",
          "Started container web-server",
          "Readiness probe passed (HTTP 200 on :8080/healthz)",
        ],
      },
      {
        id: "pod-3",
        name: "web-deploy-74b5c8-m8p3",
        status: "Ready",
        readyCount: "1/1",
        restarts: 0,
        ip: "10.244.1.15",
        node: "node-worker-alpha",
        version: "v1.0.0",
        events: [
          "Successfully assigned default/web-deploy-74b5c8-m8p3 to node-worker-alpha",
          "Container image 'learnloop/web:1.0' already present on machine",
          "Created container web-server",
          "Started container web-server",
          "Readiness probe passed (HTTP 200 on :8080/healthz)",
        ],
      },
    ],
    selectedPodId: "pod-1",
    activeScenario: "none",
    logs: [
      "[INFO] Deployment 'web-deploy' is synchronized: 3 desired, 3 available.",
      "[INFO] LoadBalancer Service 'web-service' is healthy, 3 endpoints registered.",
    ],
  };
}

export function k8sReducer(state: K8sClusterState, action: K8sAction): K8sClusterState {
  switch (action.type) {
    case "SET_REPLICAS": {
      const target = Math.max(1, Math.min(6, action.count));
      if (target === state.desiredReplicas) return state;

      if (target > state.desiredReplicas) {
        const addedCount = target - state.pods.length;
        const newPods: SimulatedPod[] = [];
        for (let i = 0; i < addedCount; i++) {
          const num = state.pods.length + i + 1;
          const id = `pod-${num}-${Date.now().toString(36).slice(-3)}`;
          newPods.push({
            id,
            name: `web-deploy-74b5c8-s${num}x`,
            status: "Ready",
            readyCount: "1/1",
            restarts: 0,
            ip: `10.244.${(num % 2) + 1}.${20 + num}`,
            node: num % 2 === 0 ? "node-worker-beta" : "node-worker-alpha",
            version: "v1.0.0",
            events: [
              `Successfully assigned default to worker node`,
              `Created container web-server`,
              `Started container web-server`,
              `Readiness probe passed`,
            ],
          });
        }
        const updatedPods = [...state.pods, ...newPods];
        return {
          ...state,
          desiredReplicas: target,
          availableReplicas: target,
          deploymentStatus: "Healthy",
          pods: updatedPods,
          logs: [
            ...state.logs.slice(-8),
            `[SCALING] Scaled deployment from ${state.desiredReplicas} to ${target} replicas.`,
          ],
        };
      } else {
        // Scale down
        const keepCount = target;
        const updatedPods = state.pods.slice(0, keepCount);
        const nextSelected =
          state.selectedPodId && updatedPods.some((p) => p.id === state.selectedPodId)
            ? state.selectedPodId
            : updatedPods[0]?.id ?? null;
        return {
          ...state,
          desiredReplicas: target,
          availableReplicas: target,
          deploymentStatus: "Healthy",
          pods: updatedPods,
          selectedPodId: nextSelected,
          logs: [
            ...state.logs.slice(-8),
            `[SCALING] Scaled down deployment to ${target} replicas. Gracefully terminated removed pods.`,
          ],
        };
      }
    }

    case "SELECT_POD":
      return { ...state, selectedPodId: action.podId };

    case "TRIGGER_FAILURE": {
      if (state.activeScenario === "readiness_probe_failure") return state;
      // Pod 3 fails readiness probe
      const updatedPods = state.pods.map((pod, idx) => {
        if (idx === state.pods.length - 1) {
          return {
            ...pod,
            status: "Unhealthy" as const,
            readyCount: "0/1" as const,
            events: [
              ...pod.events,
              "Warning Unhealthy kubelet Readiness probe failed: HTTP 500 at :8080/healthz",
              "EndpointController: Removed pod from EndpointSlice for web-service",
            ],
          };
        }
        return pod;
      });

      const failingPod = updatedPods[updatedPods.length - 1];

      return {
        ...state,
        activeScenario: "readiness_probe_failure",
        availableReplicas: Math.max(0, state.desiredReplicas - 1),
        deploymentStatus: "Degraded",
        serviceStatus: "Warning",
        pods: updatedPods,
        selectedPodId: failingPod?.id ?? state.selectedPodId,
        logs: [
          ...state.logs.slice(-8),
          `[ALERT] Pod '${failingPod?.name}' readiness probe failed: HTTP 500.`,
          `[ROUTING] 'web-service' traffic diverted away from unhealthy pod '${failingPod?.name}'.`,
          `[DEGRADED] Available replicas dropped to ${state.desiredReplicas - 1}/${state.desiredReplicas}.`,
        ],
      };
    }

    case "APPLY_CORRECTIVE_ACTION": {
      if (state.activeScenario !== "readiness_probe_failure") return state;
      // Heal the failing pod
      const updatedPods = state.pods.map((pod) => {
        if (pod.status === "Unhealthy") {
          return {
            ...pod,
            status: "Ready" as const,
            readyCount: "1/1" as const,
            events: [
              ...pod.events,
              "Applied corrective patch: Restored healthy /healthz response on port 8080",
              "Readiness probe passed (HTTP 200 on :8080/healthz)",
              "EndpointController: Added pod back to EndpointSlice for web-service",
            ],
          };
        }
        return pod;
      });

      return {
        ...state,
        activeScenario: "none",
        availableReplicas: state.desiredReplicas,
        deploymentStatus: "Healthy",
        serviceStatus: "Active",
        pods: updatedPods,
        logs: [
          ...state.logs.slice(-8),
          "[HEALING] Corrective patch applied. Readiness probe verified 200 OK.",
          "[RESTORED] Pod re-added to web-service endpoints. Cluster returned to 100% health.",
        ],
      };
    }

    case "TRIGGER_ROLLING_UPDATE": {
      const nextVersion = state.pods[0]?.version === "v1.0.0" ? "v1.1.0" : "v1.0.0";
      const updatedPods = state.pods.map((pod) => ({
        ...pod,
        version: nextVersion,
        events: [
          ...pod.events,
          `Rolling update: Pulled image tag ${nextVersion}`,
          `Container refreshed with zero downtime`,
        ],
      }));
      return {
        ...state,
        pods: updatedPods,
        logs: [
          ...state.logs.slice(-8),
          `[ROLLOUT] Rolling update triggered. All ${state.pods.length} pods transitioned to ${nextVersion} sequentially.`,
        ],
      };
    }

    case "RESTART_POD": {
      const updatedPods = state.pods.map((pod) => {
        if (pod.id === action.podId) {
          return {
            ...pod,
            restarts: pod.restarts + 1,
            events: [
              ...pod.events,
              `Simulated restart #${pod.restarts + 1} requested by student`,
              "Readiness probe passed after graceful restart",
            ],
          };
        }
        return pod;
      });
      return {
        ...state,
        pods: updatedPods,
        logs: [
          ...state.logs.slice(-8),
          `[RESTART] Pod '${action.podId}' successfully restarted.`,
        ],
      };
    }

    case "RESET":
      return createInitialK8sState();

    default:
      return state;
  }
}

export function KubernetesLab({
  onInspectEntity,
}: {
  onInspectEntity?: (info: { name: string; status: string; logs: string }) => void;
}) {
  const [state, dispatch] = useReducer(k8sReducer, undefined, createInitialK8sState);
  const selectedPod = state.pods.find((p) => p.id === state.selectedPodId) ?? state.pods[0];

  function handleSelectPod(pod: SimulatedPod) {
    dispatch({ type: "SELECT_POD", podId: pod.id });
    onInspectEntity?.({
      name: `Pod: ${pod.name}`,
      status: `${pod.status} (${pod.readyCount})`,
      logs: pod.events.slice(-2).join(" | "),
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      {/* Header & Simulation Notice */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm tracking-tight">
              Flagship Lab: Kubernetes Cluster Simulation
            </h3>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
              Deterministic Sandbox
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Interact with controllers, test failure recovery, and inspect service endpoints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              state.deploymentStatus === "Healthy"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                state.deploymentStatus === "Healthy" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {state.deploymentStatus} ({state.availableReplicas}/{state.desiredReplicas} Replicas)
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "RESET" })}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            Reset Lab
          </button>
        </div>
      </div>

      {/* Control Panel: Replicas Slider & Action Buttons */}
      <div className="grid gap-4 rounded-lg border border-border/60 bg-background/50 p-3 sm:grid-cols-2">
        {/* Replica Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="replica-slider" className="font-medium text-foreground">
              Desired Replicas:
            </label>
            <span className="font-mono font-semibold text-primary">
              {state.desiredReplicas}
            </span>
          </div>
          <input
            id="replica-slider"
            type="range"
            min={1}
            max={6}
            step={1}
            value={state.desiredReplicas}
            onChange={(e) =>
              dispatch({ type: "SET_REPLICAS", count: parseInt(e.target.value, 10) })
            }
            className="w-full cursor-pointer accent-primary"
            aria-label="Desired replica slider from 1 to 6"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>1 Pod</span>
            <span>3 Pods (Default)</span>
            <span>6 Pods</span>
          </div>
        </div>

        {/* Scenario Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {state.activeScenario === "none" ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "TRIGGER_FAILURE", scenario: "readiness_probe_failure" })}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
            >
              ⚠ Simulate Readiness Probe Failure
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: "APPLY_CORRECTIVE_ACTION" })}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 animate-pulse"
            >
              🩹 Apply Fix: Patch Probe & Endpoint
            </button>
          )}

          <button
            type="button"
            onClick={() => dispatch({ type: "TRIGGER_ROLLING_UPDATE" })}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
          >
            🔄 Trigger Rolling Update
          </button>
        </div>
      </div>

      {/* Visual Service & Pod Grid */}
      <div className="space-y-3">
        {/* LoadBalancer Service Banner */}
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">svc/web-service</span>
              <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border">
                Type: LoadBalancer (Port 80 → 8080)
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
              <span>Active Endpoints:</span>
              <span className="font-mono font-semibold text-foreground">
                {state.pods.filter((p) => p.status === "Ready").length} of {state.pods.length}
              </span>
            </div>
          </div>
        </div>

        {/* Pod Cards */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          {state.pods.map((pod) => {
            const isSelected = selectedPod?.id === pod.id;
            const isUnhealthy = pod.status === "Unhealthy";

            return (
              <button
                key={pod.id}
                type="button"
                onClick={() => handleSelectPod(pod)}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                    : isUnhealthy
                      ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-500"
                      : "border-border bg-card hover:border-border/80 hover:bg-accent/30"
                }`}
                aria-label={`Inspect ${pod.name}, status ${pod.status}`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="font-mono text-xs font-semibold text-foreground truncate max-w-[140px]">
                    {pod.name.split("-").slice(-2).join("-")}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      pod.status === "Ready"
                        ? "bg-emerald-500"
                        : "bg-amber-500 animate-ping"
                    }`}
                  />
                </div>

                <div className="mt-2 flex w-full items-center justify-between text-[11px] text-muted-foreground">
                  <span>Ready: {pod.readyCount}</span>
                  <span className="font-mono">{pod.version}</span>
                </div>

                <div className="mt-1 flex w-full items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{pod.ip}</span>
                  {pod.restarts > 0 ? (
                    <span className="text-amber-500">{pod.restarts} restarts</span>
                  ) : (
                    <span>0 restarts</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Pod Deep-Dive Inspector */}
      {selectedPod ? (
        <div className="rounded-lg border border-border bg-background/80 p-3.5 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-foreground text-xs">
                {selectedPod.name}
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-mono ${
                  selectedPod.status === "Ready"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                }`}
              >
                {selectedPod.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "RESTART_POD", podId: selectedPod.id })}
                className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent"
              >
                Restart Pod
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4 font-mono">
            <div>
              <span className="text-foreground/70">Node:</span> {selectedPod.node}
            </div>
            <div>
              <span className="text-foreground/70">Pod IP:</span> {selectedPod.ip}
            </div>
            <div>
              <span className="text-foreground/70">Image:</span> learnloop/web:{selectedPod.version}
            </div>
            <div>
              <span className="text-foreground/70">Restarts:</span> {selectedPod.restarts}
            </div>
          </div>

          {/* Pod Event Stream */}
          <div className="mt-2 space-y-1">
            <span className="font-semibold text-[11px] text-foreground">Recent Pod Events:</span>
            <div className="max-h-24 overflow-y-auto rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-300 dark:bg-black">
              {selectedPod.events.map((evt, idx) => (
                <div
                  key={idx}
                  className={`py-0.5 ${
                    evt.includes("Warning") || evt.includes("failed")
                      ? "text-amber-400 font-semibold"
                      : evt.includes("Passed") || evt.includes("Restored")
                        ? "text-emerald-400"
                        : "text-zinc-400"
                  }`}
                >
                  › {evt}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Cluster Event Logs */}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-foreground">Cluster Activity Stream:</span>
        <div className="max-h-24 overflow-y-auto rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-400 dark:bg-black">
          {state.logs.map((log, i) => (
            <div
              key={i}
              className={`py-0.5 ${
                log.includes("ALERT")
                  ? "text-amber-400 font-medium"
                  : log.includes("RESTORED") || log.includes("HEALING")
                    ? "text-emerald-400"
                    : "text-zinc-400"
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
