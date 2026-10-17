import type { ComponentType } from "react";
import {
  Cpu,
  Server,
  Database,
  Layers,
} from "lucide-react";

export type AssessmentStatus = "Passed" | "In progress" | "Needs fix" | "Evaluating";
export type AssessmentStatusFilter = "all" | AssessmentStatus;

export type AssessmentRow = {
  time: string;
  student: string;
  concept: string;
  language: string;
  runtime: string;
  status: AssessmentStatus;
  memory: string;
  testsPassed: string;
  codeSnippet: string;
};

export const assessmentStatusFilters = [
  { value: "all", label: "All assessments" },
  { value: "Passed", label: "Passed" },
  { value: "In progress", label: "In progress" },
  { value: "Needs fix", label: "Needs fix" },
  { value: "Evaluating", label: "Evaluating" },
] as const;

export function filterAssessments(
  assessments: readonly AssessmentRow[],
  filter: AssessmentStatusFilter
) {
  if (filter === "all") return [...assessments];
  return assessments.filter((a) => a.status === filter);
}

export const curriculumModuleLoad = [
  {
    label: "Docker & Containers",
    value: 42,
    percent: "38.2%",
    color: "bg-[var(--dashboard-learning)]",
  },
  {
    label: "Kubernetes Deployments",
    value: 26,
    percent: "23.6%",
    color: "bg-[var(--dashboard-secondary)]",
  },
  {
    label: "Linux Systems & POSIX",
    value: 20,
    percent: "18.2%",
    color: "bg-[var(--dashboard-mastered)]",
  },
  {
    label: "Async Runtime & Event Loop",
    value: 13,
    percent: "11.8%",
    color: "bg-[var(--dashboard-remediation)]",
  },
  {
    label: "CI/CD & Security Gates",
    value: 9,
    percent: "8.2%",
    color: "bg-destructive",
  },
] as const;

export const recentAssessments: readonly AssessmentRow[] = [
  {
    time: "10:30",
    student: "Fatima Ali",
    concept: "Docker Multi-stage Builds",
    language: "Dockerfile",
    runtime: "142ms",
    status: "Passed",
    memory: "28 MB",
    testsPassed: "3/3 hidden",
    codeSnippet: `FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCMD ["node", "dist/index.js"]`,
  },
  {
    time: "11:00",
    student: "Oliver Wright",
    concept: "Async Event Loop & Promises",
    language: "TypeScript",
    runtime: "88ms",
    status: "Needs fix",
    memory: "34 MB",
    testsPassed: "1/3 hidden",
    codeSnippet: `export async function processQueue(items: string[]) {\n  return Promise.all(items.map(async (item) => {\n    await processItem(item);\n  }));\n}`,
  },
  {
    time: "11:30",
    student: "Sophia Patel",
    concept: "K8s ReplicaSet & Rolling Update",
    language: "YAML",
    runtime: "210ms",
    status: "Passed",
    memory: "42 MB",
    testsPassed: "4/4 hidden",
    codeSnippet: `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: learner-app\nspec:\n  replicas: 3\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0`,
  },
  {
    time: "12:00",
    student: "Ethan Lee",
    concept: "POSIX Pipe & Fork Buffers",
    language: "C++",
    runtime: "32ms",
    status: "Passed",
    memory: "16 MB",
    testsPassed: "5/5 hidden",
    codeSnippet: `int pipefd[2];\npipe(pipefd);\npid_t pid = fork();\nif (pid == 0) {\n  close(pipefd[0]);\n  dup2(pipefd[1], STDOUT_FILENO);\n  execlp("ls", "ls", NULL);\n}`,
  },
  {
    time: "12:30",
    student: "Isabella Kim",
    concept: "Git Conflict & Interactive Rebase",
    language: "Bash",
    runtime: "64ms",
    status: "In progress",
    memory: "18 MB",
    testsPassed: "2/3 hidden",
    codeSnippet: `git checkout -b feature/auth\ngit add .\ngit commit -m "Add auth layer"\ngit rebase origin/main`,
  },
  {
    time: "13:00",
    student: "Liam Nguyen",
    concept: "Network Policy & Ingress Rules",
    language: "YAML",
    runtime: "195ms",
    status: "Passed",
    memory: "38 MB",
    testsPassed: "3/3 hidden",
    codeSnippet: `apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-frontend\nspec:\n  podSelector:\n    matchLabels:\n      role: db`,
  },
] as const;

export const studentCohortPerformance = [
  {
    name: "Alex Rivera",
    role: "Full-Stack Track",
    points: 148,
    rating: "98% BKT",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex%20Rivera",
  },
  {
    name: "Fatima Ali",
    role: "DevOps & Cloud",
    points: 132,
    rating: "94% BKT",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Fatima%20Ali",
  },
  {
    name: "Sophia Patel",
    role: "Systems & Cloud",
    points: 124,
    rating: "91% BKT",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sophia%20Patel",
  },
] as const;

export const sandboxResources = [
  {
    label: "Isolated Linux Containers",
    value: 78,
    unit: "Active",
    Icon: Server,
    color: "bg-[var(--dashboard-learning)]",
  },
  {
    label: "Worker Queue (BullMQ)",
    value: 64,
    unit: "Load",
    Icon: Cpu,
    color: "bg-[var(--dashboard-mastered)]",
  },
  {
    label: "Telemetry Event Buffer",
    value: 86,
    unit: "Stored",
    Icon: Database,
    color: "bg-[var(--dashboard-secondary)]",
  },
  {
    label: "Memory Ceiling Usage",
    value: 52,
    unit: "Quota",
    Icon: Layers,
    color: "bg-[var(--dashboard-remediation)]",
  },
] as const;

export const portalMetrics = [
  {
    label: "Average Mastery (BKT)",
    value: "84",
    suffix: "%",
    trend: "+6.4% this cohort",
    color: "bg-[var(--dashboard-mastered)]",
    trendColor: "text-[var(--dashboard-mastered)]",
    lastSixDays: [62, 68, 74, 79, 81, 84],
  },
  {
    label: "Sandbox Executions",
    value: "142",
    suffix: "runs",
    trend: "94% pass rate",
    color: "bg-[var(--dashboard-learning)]",
    trendColor: "text-[var(--dashboard-learning)]",
    lastSixDays: [88, 112, 134, 128, 139, 142],
  },
  {
    label: "Concept Syllabus Progress",
    value: "18",
    suffix: "/24",
    trend: "Threshold 0.85 BKT",
    color: "bg-[var(--dashboard-secondary)]",
    trendColor: "text-[var(--dashboard-mastered)]",
    lastSixDays: [10, 12, 14, 15, 17, 18],
  },
  {
    label: "Integrity Verification",
    value: "100",
    suffix: "%",
    trend: "0 flagged sessions",
    color: "bg-[var(--dashboard-remediation)]",
    trendColor: "text-[var(--dashboard-mastered)]",
    lastSixDays: [99, 100, 100, 98, 100, 100],
  },
] as const;

export const portalTimelineRanges = [
  { value: "current-sprint", label: "Current Sprint (Sprint 14)" },
  { value: "last-sprint", label: "Last Sprint (Sprint 13)" },
  { value: "q3-cohort", label: "Q3 Engineering Cohort" },
  { value: "all-time", label: "Cumulative Mastery" },
] as const;

export const weeklyVolumeData = [
  { week: "Week 1", scheduled: 180, completed: 165, noShow: 15 },
  { week: "Week 2", scheduled: 210, completed: 192, noShow: 18 },
  { week: "Week 3", scheduled: 245, completed: 231, noShow: 14 },
  { week: "Week 4", scheduled: 270, completed: 254, noShow: 16 },
] as const;
