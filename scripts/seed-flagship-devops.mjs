import { db } from "../db/index.js";
import { lessons } from "../db/schema/index.js";
import { validateScene } from "@openmaic/dsl";
import { inspectLesson } from "../lib/engine/lesson-quality.js";
import { previewScenes } from "../lib/engine/lesson-preview.js";
import { eq, and } from "drizzle-orm";

const instituteId = "19ef66bb-22ee-45d8-9aeb-b391a933ec63";
const conceptId = "060f4e53-e15a-4342-8cda-d400eaba4e95"; // Functions (Ada's recommended concept)
const moduleId = "afa59d34-6086-4bdb-96a4-76b8db93beaa"; // TypeScript OOP

const title = "DevOps Engineering: From Code to Production";
const topic = "DevOps Engineering: From Code to Production";
const objectives = "Understand the complete software delivery lifecycle: visual delivery architecture, automated CI/CD gating, multi-stage containerization, Kubernetes cluster orchestration, readiness probe failure recovery, and site reliability patterns.";

const outlines = [
  {
    id: "out-1",
    type: "slide",
    title: "Introduction to Modern Software Delivery",
    description: "Overview of modern automated delivery vs manual deployments.",
    keyPoints: ["Continuous delivery", "Automated feedback loops", "Resilient topologies"],
    order: 1,
  },
  {
    id: "out-2",
    type: "slide",
    title: "The End-to-End Delivery Architecture",
    description: "Visual topology of the software delivery pipeline from developer to production monitoring.",
    keyPoints: ["Topology mapping", "Component relationships", "Inspection of stages"],
    order: 2,
  },
  {
    id: "out-3",
    type: "slide",
    title: "Step-by-Step Deployment Lifecycle",
    description: "Controlled pedagogical stepping through the deployment phases.",
    keyPoints: ["Step progression", "Verification gates", "Zero-downtime rollouts"],
    order: 3,
  },
  {
    id: "out-4",
    type: "slide",
    title: "Multi-Stage Container Definition",
    description: "Code walkthrough of a hardened production Dockerfile with annotations.",
    keyPoints: ["Multi-stage builds", "Distroless base images", "Nonroot execution"],
    order: 4,
  },
  {
    id: "out-5",
    type: "slide",
    title: "Interactive Docker & Container Lab",
    description: "Interactive simulation of container build, execution, and health check testing.",
    keyPoints: ["Docker build logs", "Container runtime lifecycle", "Local endpoint probing"],
    order: 5,
  },
  {
    id: "out-6",
    type: "slide",
    title: "Visual CI/CD Automation Pipeline",
    description: "Interactive pipeline runner testing automated test gating and failure blocking.",
    keyPoints: ["6 pipeline stages", "Automated test gates", "Protected production deploys"],
    order: 6,
  },
  {
    id: "out-7",
    type: "slide",
    title: "Flagship Kubernetes Cluster Simulation",
    description: "Interactive cluster orchestration with replica controls, readiness probe failure, and self-healing.",
    keyPoints: ["Replica controllers", "Readiness probe failures", "Traffic isolation", "Self-healing recovery"],
    order: 7,
  },
  {
    id: "out-8",
    type: "slide",
    title: "Troubleshooting & Site Reliability Patterns",
    description: "Explanation of probe differences, graceful shutdown, and reliability best practices.",
    keyPoints: ["Liveness vs readiness", "Graceful SIGTERM handling", "SLO error budgets"],
    order: 8,
  },
  {
    id: "out-9",
    type: "quiz",
    title: "DevOps Architecture Knowledge Check",
    description: "Interactive knowledge check questions verifying conceptual mastery of delivery patterns.",
    keyPoints: ["Readiness probe mechanics", "Multi-stage build security", "Pipeline gating"],
    order: 9,
    quizConfig: {
      questionCount: 3,
      difficulty: "medium",
      questionTypes: ["single"],
    },
  },
  {
    id: "out-10",
    type: "slide",
    title: "Production Readiness & Best Practices Summary",
    description: "Comprehensive review of production readiness and Site Reliability Engineering guidelines.",
    keyPoints: ["4 golden signals", "Automated rollbacks", "Production checklist"],
    order: 10,
  },
];

const scenes = [
  // Scene 1: Introduction
  {
    id: "scene-devops-1",
    outlineId: "out-1",
    stageId: "stg-1",
    order: 1,
    type: "slide",
    role: "introduction",
    title: "Introduction to Modern Software Delivery",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-1",
            type: "text",
            content: "<p>Modern software engineering requires rapid, reliable, and repeatable delivery from source commit to production clusters. Manual deployments introduce configuration drift, human error, and production downtime. In contrast, modern DevOps pipelines treat infrastructure, testing, and deployment as declarative code.</p>",
          },
          {
            id: "el-2",
            type: "text",
            content: "<p>| Paradigm | Release Cadence | Failure Recovery | Production Protection |\n| Manual Deploys | Weeks or months | Manual rollbacks | Prone to human oversight |\n| Automated CI/CD | Multiple per day | Automated self-healing | Enforced quality gates |</p>",
          },
        ],
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 2: Architecture Diagram
  {
    id: "scene-devops-2",
    outlineId: "out-2",
    stageId: "stg-2",
    order: 2,
    type: "slide",
    role: "diagram",
    title: "The End-to-End Delivery Architecture",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-2-1",
            type: "text",
            content: "<p>Explore the end-to-end software delivery pipeline below. Select any stage to inspect its role, operational dependencies, and gating requirements.</p>",
          },
        ],
      },
      diagram: {
        title: "Software Delivery Architecture Map",
        description: "Continuous integration, container packaging, cluster orchestration, and monitoring topology.",
        nodes: [
          {
            id: "dev",
            label: "Developer",
            description: "Engineers write code, run local unit tests, and open pull requests with signed commits.",
            category: "source",
            status: "healthy",
            metadata: { Tool: "VS Code / IDE", Branch: "feature/auth" },
          },
          {
            id: "git",
            label: "Git Repository",
            description: "Centralized version control system triggering automated webhooks on merge to the main branch.",
            category: "source",
            status: "healthy",
            metadata: { VCS: "GitHub Enterprise", BranchProtection: "Strict" },
          },
          {
            id: "build",
            label: "CI Build & Lint",
            description: "Automated runners execute typecheck, formatting, and linting to ensure code standards.",
            category: "build",
            status: "active",
            metadata: { Runner: "Docker Ubuntu", Concurrency: "4" },
          },
          {
            id: "test",
            label: "Automated Tests",
            description: "Unit, integration, and security regression gates block invalid commits from progressing.",
            category: "test",
            status: "healthy",
            metadata: { TestFramework: "Jest / Vitest", Gate: "Strict Pass Required" },
          },
          {
            id: "registry",
            label: "Container Registry",
            description: "Immutable OCI container images tagged by git commit SHA and cryptographically signed.",
            category: "registry",
            status: "healthy",
            metadata: { Registry: "OCI Registry", Digest: "sha256:7f4a9b" },
          },
          {
            id: "deploy",
            label: "Kubernetes Cluster",
            description: "Orchestrator manages replica pods, rolling updates, service endpoints, and self-healing.",
            category: "deploy",
            status: "healthy",
            metadata: { Cluster: "Production k8s", Namespace: "default" },
          },
          {
            id: "monitor",
            label: "Monitoring & SRE",
            description: "Prometheus metrics, health probes, and distributed traces track latency and error budgets.",
            category: "monitor",
            status: "healthy",
            metadata: { Telemetry: "OpenTelemetry", SLO: "99.95% Availability" },
          },
        ],
        edges: [
          { from: "dev", to: "git", label: "git push", animated: true },
          { from: "git", to: "build", label: "webhook", animated: true },
          { from: "build", to: "test", label: "compile pass", animated: true },
          { from: "test", to: "registry", label: "package image", animated: true },
          { from: "registry", to: "deploy", label: "pull & rollout", animated: true },
          { from: "deploy", to: "monitor", label: "scrape metrics", animated: true },
        ],
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 3: Step-by-Step Deployment Lifecycle
  {
    id: "scene-devops-3",
    outlineId: "out-3",
    stageId: "stg-3",
    order: 3,
    type: "slide",
    role: "step_by_step",
    title: "Step-by-Step Deployment Lifecycle",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-3-1",
            type: "text",
            content: "<p>Follow the controlled pedagogical sequence below to observe how each stage guarantees system invariants before artifacts advance.</p>",
          },
        ],
      },
      stepper: {
        title: "Deployment Progression Pipeline",
        steps: [
          {
            id: "step-1",
            title: "Commit & Static Analysis",
            explanation: "Code is validated locally and in CI using strict TypeScript typing and linting before any build proceeds.",
            callout: "Catching syntax and type errors early prevents expensive container builds downstream.",
            diagramHighlightNodeIds: ["dev", "git", "build"],
          },
          {
            id: "step-2",
            title: "Unit & Integration Test Gates",
            explanation: "Automated test suites execute against mock databases and external dependencies to verify behavioral contracts.",
            callout: "If any test fails, the pipeline aborts immediately; zero unverified code reaches staging.",
            diagramHighlightNodeIds: ["test"],
          },
          {
            id: "step-3",
            title: "Immutable Container Packaging",
            explanation: "Multi-stage Docker builds assemble minimal production images stripped of compilers, debuggers, and package managers.",
            callout: "Distroless base images reduce attack surface vulnerabilities to near zero.",
            diagramHighlightNodeIds: ["registry"],
          },
          {
            id: "step-4",
            title: "Zero-Downtime Rolling Update",
            explanation: "Kubernetes updates pods incrementally, ensuring available replicas meet customer demand during rollout.",
            callout: "Readiness probes protect user requests from hitting cold containers during startup initialization.",
            diagramHighlightNodeIds: ["deploy"],
          },
          {
            id: "step-5",
            title: "Active Telemetry & Health Verification",
            explanation: "Production monitoring observes latency percentiles and error budgets, enabling automated rollback if SLOs degrade.",
            callout: "Continuous telemetry closes the feedback loop back to the engineering team.",
            diagramHighlightNodeIds: ["monitor"],
          },
        ],
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 4: Code Walkthrough
  {
    id: "scene-devops-4",
    outlineId: "out-4",
    stageId: "stg-4",
    order: 4,
    type: "slide",
    role: "code_walkthrough",
    title: "Multi-Stage Container Definition",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-4-1",
            type: "text",
            content: "<p>Inspect the production Dockerfile below. Multi-stage builds compile artifacts in a builder image and copy only minimal runtime files into the final release container.</p>",
          },
        ],
      },
      walkthrough: {
        title: "Production Dockerfile Multi-Stage Build",
        language: "dockerfile",
        filename: "Dockerfile",
        code: `# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Minimal Distroless Production Runtime
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
EXPOSE 8080
USER nonroot
CMD ["src/server.js"]`,
        annotations: [
          {
            lineStart: 1,
            lineEnd: 5,
            title: "Builder Stage",
            explanation: "Uses a temporary Alpine container with npm and build tools to cleanly install production dependencies.",
          },
          {
            lineStart: 7,
            lineEnd: 8,
            title: "Distroless Runtime Base",
            explanation: "Uses Google Distroless nodejs20 image. It contains NO package manager, curl, or bash shell, minimizing exploit opportunities.",
          },
          {
            lineStart: 9,
            lineEnd: 11,
            title: "Selective Artifact Copy",
            explanation: "Copies only verified node_modules and application source code from the builder stage, keeping the final image lightweight (under 50MB).",
          },
          {
            lineStart: 12,
            lineEnd: 14,
            title: "Security Hardening & Entrypoint",
            explanation: "Exposes port 8080, switches user to 'nonroot' to prevent container breakout, and launches the microservice.",
          },
        ],
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 5: Docker Lab
  {
    id: "scene-devops-5",
    outlineId: "out-5",
    stageId: "stg-5",
    order: 5,
    type: "slide",
    role: "interactive_lab",
    title: "Interactive Docker & Container Lab",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-5-1",
            type: "text",
            content: "<p>Build, run, and test a containerized microservice directly in this interactive terminal simulation.</p>",
          },
        ],
      },
      lab: {
        kind: "docker",
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 6: CI/CD Lab
  {
    id: "scene-devops-6",
    outlineId: "out-6",
    stageId: "stg-6",
    order: 6,
    type: "slide",
    role: "interactive_lab",
    title: "Visual CI/CD Automation Pipeline",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-6-1",
            type: "text",
            content: "<p>Trigger pipeline runs, inspect stage artifacts, and observe how automated test gates protect downstream production environments.</p>",
          },
        ],
      },
      lab: {
        kind: "cicd",
        allowFailureSimulation: true,
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 7: Flagship Kubernetes Lab
  {
    id: "scene-devops-7",
    outlineId: "out-7",
    stageId: "stg-7",
    order: 7,
    type: "slide",
    role: "interactive_lab",
    title: "Flagship Kubernetes Cluster Simulation",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-7-1",
            type: "text",
            content: "<p>Orchestrate replicas, observe rolling updates, simulate a readiness probe failure, inspect events, and apply self-healing corrective actions.</p>",
          },
        ],
      },
      lab: {
        kind: "k8s",
        initialReplicas: 3,
        scenario: "readiness_probe_failure",
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 8: SRE Patterns Explanation
  {
    id: "scene-devops-8",
    outlineId: "out-8",
    stageId: "stg-8",
    order: 8,
    type: "slide",
    role: "explanation",
    title: "Troubleshooting & Site Reliability Patterns",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-8-1",
            type: "text",
            content: "<p>Understanding the distinction between container lifecycle states is essential for diagnosing production anomalies without causing cascading outages.</p>",
          },
          {
            id: "el-8-2",
            type: "text",
            content: "<p>| Probe Type | Purpose | Action on Failure |\n| Liveness Probe | Detects fatal deadlocks | Kubelet restarts the container |\n| Readiness Probe | Detects temporary unreadiness | Service stops sending traffic |\n| Startup Probe | Guards slow initialization | Disables liveness checks until ready |</p>",
          },
          {
            id: "el-8-3",
            type: "text",
            content: "<p>1. Check pod events using describe pod to view recent warning events.\n2. Verify whether the application container is running or crash-looping.\n3. Test the HTTP probe endpoint directly inside the network namespace.\n4. Apply targeted configuration or handler patches rather than rebooting worker nodes.</p>",
          },
        ],
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 9: Knowledge Check
  {
    id: "scene-devops-9",
    outlineId: "out-9",
    stageId: "stg-9",
    order: 9,
    type: "quiz",
    role: "knowledge_check",
    title: "DevOps Architecture Knowledge Check",
    content: {
      type: "quiz",
      questions: [
        {
          id: "q-1",
          question: "What action does Kubernetes take when a pod's readiness probe returns HTTP 500?",
          options: [
            { id: "opt-1a", label: "It immediately kills and restarts the container." },
            { id: "opt-1b", label: "It removes the pod IP from active LoadBalancer endpoints without killing the process." },
            { id: "opt-1c", label: "It deletes the pod and provisions a brand new worker node." },
            { id: "opt-1d", label: "It triggers an automatic cluster-wide rollback." },
          ],
          answer: ["It removes the pod IP from active LoadBalancer endpoints without killing the process."],
        },
        {
          id: "q-2",
          question: "Why do multi-stage Docker builds separate build tools from the final runtime container?",
          options: [
            { id: "opt-2a", label: "To increase container image size for local layer caching." },
            { id: "opt-2b", label: "To prevent JavaScript files from being executed." },
            { id: "opt-2c", label: "To minimize final image size and eliminate attack vectors by omitting compilers and shells." },
            { id: "opt-2d", label: "Because Kubernetes only accepts single-layer files." },
          ],
          answer: ["To minimize final image size and eliminate attack vectors by omitting compilers and shells."],
        },
        {
          id: "q-3",
          question: "If an automated test fails during CI/CD Stage 3, what must happen to downstream deployment stages?",
          options: [
            { id: "opt-3a", label: "Downstream stages should proceed and patch bugs directly in production." },
            { id: "opt-3b", label: "Downstream stages must be blocked immediately to protect staging and production environments." },
            { id: "opt-3c", label: "The test results should be ignored unless an engineer manually overrides them." },
            { id: "opt-3d", label: "The runner should automatically delete the repository." },
          ],
          answer: ["Downstream stages must be blocked immediately to protect staging and production environments."],
        },
      ],
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Scene 10: Summary
  {
    id: "scene-devops-10",
    outlineId: "out-10",
    stageId: "stg-10",
    order: 10,
    type: "slide",
    role: "summary",
    title: "Production Readiness & Best Practices Summary",
    content: {
      type: "slide",
      canvas: {
        elements: [
          {
            id: "el-10-1",
            type: "text",
            content: "<p>You have completed the DevOps Engineering learning journey. High-performing software delivery teams combine declarative infrastructure, immutable container packaging, automated quality gating, and resilient orchestration.</p>",
          },
          {
            id: "el-10-2",
            type: "text",
            content: "<p>1. Keep container images minimal, stateless, and hardened as nonroot.\n2. Configure explicit readiness probes to guard network traffic during rollouts.\n3. Never bypass automated test gates in CI/CD pipelines.\n4. Monitor the four golden signals: latency, traffic volume, error rate, and saturation.</p>",
          },
        ],
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

console.log("Validating all 10 scenes with @openmaic/dsl...");
for (const [idx, sc] of scenes.entries()) {
  const result = validateScene(sc);
  if (!result.valid) {
    console.error(`Scene ${idx + 1} (${sc.title}) failed DSL validation:`, result.errors);
    process.exit(1);
  }
}
console.log("All 10 scenes passed @openmaic/dsl validation!");

console.log("Validating lesson quality with inspectLesson...");
const issues = inspectLesson(scenes, "language:typescript");
const blocking = issues.filter((i) => i.severity === "error");
if (blocking.length > 0) {
  console.error("Blocking quality issues found:", blocking);
  process.exit(1);
}
console.log(`Quality check passed with 0 blocking errors (warnings: ${issues.length})!`);

const preview = previewScenes(scenes, true, "typescript");
console.log(`Successfully generated ${preview.length} preview scenes!`);
console.log("Roles:", preview.map((p) => p.role));

// Seed or update in database
const [existing] = await db
  .select()
  .from(lessons)
  .where(and(eq(lessons.instituteId, instituteId), eq(lessons.title, title)))
  .limit(1);

if (existing) {
  console.log(`Updating existing lesson ${existing.id}...`);
  await db
    .update(lessons)
    .set({
      topic,
      objectives,
      outlineJson: outlines,
      scenesJson: scenes,
      status: "published",
      publishedAt: new Date(),
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, existing.id));
  console.log(`Lesson ${existing.id} updated and published!`);
} else {
  console.log("Inserting new published lesson...");
  const [created] = await db
    .insert(lessons)
    .values({
      instituteId,
      moduleId,
      conceptId,
      createdBy: "ROtyMEo2nIIUnlVNWoxG9fSuuetzeqWX", // Trainer Carol
      title,
      topic,
      objectives,
      learnerLevel: "intermediate",
      durationMinutes: 35,
      sourceMaterial: "Comprehensive guide to CI/CD, Docker packaging, Kubernetes orchestration, and site reliability.",
      status: "published",
      languageDirective: "language:typescript",
      outlineJson: outlines,
      scenesJson: scenes,
      publishedAt: new Date(),
    })
    .returning();
  console.log(`Created flagship lesson with ID: ${created.id}`);
}

process.exit(0);
