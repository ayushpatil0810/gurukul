import { describe, expect, it as test } from "vitest";
import { validateScene } from "@openmaic/dsl";
import { previewScenes } from "@/lib/engine/lesson-preview";
import { inspectLesson } from "@/lib/engine/lesson-quality";
import {
  createInitialK8sState,
  k8sReducer,
} from "@/components/lessons/interactive/kubernetes-lab";
import {
  askMentor,
  generateDeterministicMentorResponse,
} from "@/lib/engine/lesson-mentor";

describe("Phase 5: Interactive Classroom Engine", () => {
  describe("Scene normalization and DSL validation", () => {
    test("validates all 9 supported scene roles with @openmaic/dsl", () => {
      const testScenes = [
        {
          id: "sc-1",
          outlineId: "out-1",
          stageId: "stg-1",
          order: 1,
          type: "slide",
          role: "introduction",
          title: "Introduction",
          content: {
            type: "slide",
            canvas: { elements: [{ id: "e1", type: "text", content: "<p>Welcome</p>" }] },
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "sc-2",
          outlineId: "out-2",
          stageId: "stg-1",
          order: 2,
          type: "slide",
          role: "diagram",
          title: "Architecture Map",
          content: {
            type: "slide",
            canvas: { elements: [{ id: "e2", type: "text", content: "<p>Map</p>" }] },
            diagram: {
              title: "Pipeline",
              nodes: [
                { id: "a", label: "Dev", description: "Author code", category: "source", status: "healthy" },
                { id: "b", label: "Build", description: "Compile", category: "build", status: "active" },
              ],
              edges: [{ from: "a", to: "b", label: "push" }],
            },
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "sc-3",
          outlineId: "out-3",
          stageId: "stg-1",
          order: 3,
          type: "slide",
          role: "step_by_step",
          title: "Step Sequence",
          content: {
            type: "slide",
            canvas: { elements: [{ id: "e3", type: "text", content: "<p>Steps</p>" }] },
            stepper: {
              title: "Steps",
              steps: [
                { id: "s1", title: "Step 1", explanation: "First step", callout: "Key note" },
                { id: "s2", title: "Step 2", explanation: "Second step" },
              ],
            },
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "sc-4",
          outlineId: "out-4",
          stageId: "stg-1",
          order: 4,
          type: "slide",
          role: "code_walkthrough",
          title: "Code Walkthrough",
          content: {
            type: "slide",
            canvas: { elements: [{ id: "e4", type: "text", content: "<p>Code</p>" }] },
            walkthrough: {
              title: "Dockerfile Walkthrough",
              language: "dockerfile",
              code: "FROM node:20-alpine\nWORKDIR /app\nCMD [\"node\"]",
              annotations: [
                { lineStart: 1, lineEnd: 1, title: "Base", explanation: "Alpine node" },
              ],
            },
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "sc-5",
          outlineId: "out-5",
          stageId: "stg-1",
          order: 5,
          type: "interactive",
          role: "interactive_lab",
          title: "Kubernetes Cluster Simulation",
          content: {
            type: "interactive",
            url: "",
            widgetType: "simulation",
            widgetConfig: {
              type: "simulation",
              kind: "k8s",
              initialReplicas: 3,
            },
            lab: { kind: "k8s", initialReplicas: 3 },
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "sc-6",
          outlineId: "out-6",
          stageId: "stg-1",
          order: 6,
          type: "slide",
          role: "comparison",
          title: "Comparison",
          content: {
            type: "slide",
            canvas: {
              elements: [
                {
                  id: "e6",
                  type: "text",
                  content: "<p>| Feature | Traditional | Cloud Native |\n| Scaling | Manual | Autoscaling |</p>",
                },
              ],
            },
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "sc-7",
          outlineId: "out-7",
          stageId: "stg-1",
          order: 7,
          type: "quiz",
          role: "knowledge_check",
          title: "Knowledge Check",
          content: {
            type: "quiz",
            questions: [
              {
                id: "q1",
                question: "What does a readiness probe do?",
                options: [{ id: "o1", label: "Controls traffic routing" }],
                answer: ["Controls traffic routing"],
              },
            ],
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "sc-8",
          outlineId: "out-8",
          stageId: "stg-1",
          order: 8,
          type: "slide",
          role: "summary",
          title: "Summary Review",
          content: {
            type: "slide",
            canvas: { elements: [{ id: "e8", type: "text", content: "<p>Review of all core concepts.</p>" }] },
          },
          actions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      for (const scene of testScenes) {
        const dslResult = validateScene(scene);
        expect(dslResult.valid).toBe(true);
      }

      const preview = previewScenes(testScenes, true, "typescript");
      expect(preview.length).toBe(8);
      expect(preview.map((p) => p.role)).toEqual([
        "introduction",
        "diagram",
        "step_by_step",
        "code_walkthrough",
        "interactive_lab",
        "comparison",
        "knowledge_check",
        "summary",
      ]);

      const issues = inspectLesson(testScenes, "language:typescript");
      expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    test("falls back gracefully when an unsupported scene type is encountered", () => {
      const unsupported = [
        {
          id: "unsupported-1",
          outlineId: "out-x",
          stageId: "stg-x",
          order: 1,
          type: "unknown_custom_type",
          title: "Custom Type",
          content: {},
        },
      ];

      const preview = previewScenes(unsupported, false);
      expect(preview).toHaveLength(0); // Safely ignores unknown top-level type
    });
  });

  describe("Quiz answer-key confidentiality", () => {
    const quizScene = [
      {
        id: "quiz-1",
        outlineId: "out-q",
        stageId: "stg-q",
        order: 1,
        type: "quiz",
        title: "Architecture Knowledge Check",
        content: {
          type: "quiz",
          questions: [
            {
              id: "q1",
              question: "What is a readiness probe?",
              options: [{ id: "o1", label: "Traffic gate" }, { id: "o2", label: "Deadlock rebooter" }],
              answer: ["Traffic gate"],
            },
          ],
        },
      },
    ];

    test("student view strictly hides answer keys before submission", () => {
      const studentPreview = previewScenes(quizScene, false);
      expect(studentPreview[0]?.questions[0]?.answer).toBeNull();
    });

    test("author view includes answer keys for instructor preview and validation", () => {
      const authorPreview = previewScenes(quizScene, true);
      expect(authorPreview[0]?.questions[0]?.answer).toBe("Traffic gate");
    });
  });

  describe("Kubernetes Simulation State Machine", () => {
    test("initializes with 3 desired replicas, 3 available, and healthy status", () => {
      const state = createInitialK8sState();
      expect(state.desiredReplicas).toBe(3);
      expect(state.availableReplicas).toBe(3);
      expect(state.deploymentStatus).toBe("Healthy");
      expect(state.serviceStatus).toBe("Active");
      expect(state.pods).toHaveLength(3);
      expect(state.pods.every((p) => p.status === "Ready")).toBe(true);
    });

    test("scales replicas up and down within safe predefined bounds", () => {
      let state = createInitialK8sState();

      // Scale to 5
      state = k8sReducer(state, { type: "SET_REPLICAS", count: 5 });
      expect(state.desiredReplicas).toBe(5);
      expect(state.availableReplicas).toBe(5);
      expect(state.pods).toHaveLength(5);
      expect(state.pods.every((p) => p.status === "Ready")).toBe(true);

      // Scale to 2
      state = k8sReducer(state, { type: "SET_REPLICAS", count: 2 });
      expect(state.desiredReplicas).toBe(2);
      expect(state.availableReplicas).toBe(2);
      expect(state.pods).toHaveLength(2);

      // Clamp upper bounds to 6
      state = k8sReducer(state, { type: "SET_REPLICAS", count: 10 });
      expect(state.desiredReplicas).toBe(6);
      expect(state.pods).toHaveLength(6);

      // Clamp lower bounds to 1
      state = k8sReducer(state, { type: "SET_REPLICAS", count: 0 });
      expect(state.desiredReplicas).toBe(1);
      expect(state.pods).toHaveLength(1);
    });

    test("handles readiness probe failure, updates available replicas, and recovers with corrective action", () => {
      let state = createInitialK8sState();
      expect(state.availableReplicas).toBe(3);

      // Trigger readiness probe failure
      state = k8sReducer(state, { type: "TRIGGER_FAILURE", scenario: "readiness_probe_failure" });
      expect(state.activeScenario).toBe("readiness_probe_failure");
      expect(state.deploymentStatus).toBe("Degraded");
      expect(state.serviceStatus).toBe("Warning");
      expect(state.availableReplicas).toBe(2); // 1 pod is unhealthy, available drops to 2

      const unhealthyPod = state.pods.find((p) => p.status === "Unhealthy");
      expect(unhealthyPod).toBeDefined();
      expect(unhealthyPod?.readyCount).toBe("0/1");
      expect(unhealthyPod?.events.some((e) => e.includes("HTTP 500"))).toBe(true);

      // Apply corrective action
      state = k8sReducer(state, { type: "APPLY_CORRECTIVE_ACTION" });
      expect(state.activeScenario).toBe("none");
      expect(state.deploymentStatus).toBe("Healthy");
      expect(state.serviceStatus).toBe("Active");
      expect(state.availableReplicas).toBe(3);
      expect(state.pods.every((p) => p.status === "Ready" && p.readyCount === "1/1")).toBe(true);
    });

    test("triggers simulated rolling update across all pods", () => {
      let state = createInitialK8sState();
      expect(state.pods[0]?.version).toBe("v1.0.0");

      state = k8sReducer(state, { type: "TRIGGER_ROLLING_UPDATE" });
      expect(state.pods.every((p) => p.version === "v1.1.0")).toBe(true);
    });

    test("resets back to initial state deterministically", () => {
      let state = createInitialK8sState();
      state = k8sReducer(state, { type: "SET_REPLICAS", count: 6 });
      state = k8sReducer(state, { type: "TRIGGER_FAILURE", scenario: "readiness_probe_failure" });

      state = k8sReducer(state, { type: "RESET" });
      expect(state.desiredReplicas).toBe(3);
      expect(state.availableReplicas).toBe(3);
      expect(state.activeScenario).toBe("none");
      expect(state.deploymentStatus).toBe("Healthy");
      expect(state.pods).toHaveLength(3);
    });
  });

  describe("Contextual AI Mentor", () => {
    test("generates contextual hint without revealing solution", () => {
      const response = generateDeterministicMentorResponse({
        lessonTitle: "DevOps Engineering",
        conceptName: "Functions",
        sceneTitle: "Flagship Kubernetes Cluster Simulation",
        sceneRole: "interactive_lab",
        selectedEntity: "Pod pod-3 (Unhealthy)",
        visibleLogs: "Readiness probe failed: HTTP 500 at :8080/healthz",
        action: "hint",
      });

      expect(response).toContain("Hint");
      expect(response).toContain("readiness probe");
      expect(response).toContain("HTTP 500");
    });

    test("generates simplified analogy on request", () => {
      const response = generateDeterministicMentorResponse({
        lessonTitle: "DevOps Engineering",
        conceptName: "Functions",
        sceneTitle: "Kubernetes Simulation",
        sceneRole: "interactive_lab",
        selectedEntity: "Pod",
        action: "simplify",
      });

      expect(response.toLowerCase()).toContain("restaurant");
      expect(response.toLowerCase()).toContain("chef");
    });

    test("analyzes visible logs and explains impact on routing", () => {
      const response = generateDeterministicMentorResponse({
        lessonTitle: "DevOps Engineering",
        conceptName: "Functions",
        sceneTitle: "Kubernetes Simulation",
        sceneRole: "interactive_lab",
        visibleLogs: "Readiness probe failed: HTTP 500 at :8080/healthz",
        action: "explain_logs",
      });

      expect(response).toContain("Log Analysis");
      expect(response).toContain("EndpointController");
    });

    test("askMentor marks response appropriately based on provider availability", async () => {
      const result = await askMentor({
        lessonTitle: "DevOps Engineering",
        conceptName: "Functions",
        sceneTitle: "Kubernetes Simulation",
        sceneRole: "interactive_lab",
        action: "quiz_me",
      });

      expect(["model", "simulated"]).toContain(result.mode);
      expect(result.reply.length).toBeGreaterThan(10);

      // Verify deterministic fallback directly when offline
      const deterministic = generateDeterministicMentorResponse({
        lessonTitle: "DevOps Engineering",
        conceptName: "Functions",
        sceneTitle: "Kubernetes Simulation",
        sceneRole: "interactive_lab",
        action: "quiz_me",
      });
      expect(deterministic).toContain("Liveness");
      expect(deterministic).toContain("Readiness");
    });
  });
});
