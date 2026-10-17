"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { PreviewScene, SceneRole } from "@/lib/engine/lesson-preview";
import { ArchitectureDiagram } from "@/components/lessons/interactive/architecture-diagram";
import { StepByStepViewer } from "@/components/lessons/interactive/step-by-step";
import { CodeWalkthrough } from "@/components/lessons/interactive/code-walkthrough";
import { KubernetesLab } from "@/components/lessons/interactive/kubernetes-lab";
import { DockerLab } from "@/components/lessons/interactive/docker-lab";
import { CicdLab } from "@/components/lessons/interactive/cicd-lab";
import { InteractiveKnowledgeCheck } from "@/components/lessons/interactive/interactive-quiz";
import { AiMentor } from "@/components/lessons/mentor/ai-mentor";
import { ClassroomTracker } from "@/components/lessons/telemetry/classroom-tracker";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-3 font-mono text-xs text-muted-foreground">Loading code editor…</div>,
});

export const roleLabel: Record<SceneRole, string> = {
  introduction: "Concept introduction",
  intro: "Concept introduction",
  explanation: "Explanation",
  diagram: "Architecture diagram",
  code: "Code walkthrough",
  code_walkthrough: "Code walkthrough",
  comparison: "Comparison",
  steps: "Step by step",
  step_by_step: "Step by step",
  interactive_lab: "Interactive lab",
  check: "Knowledge check",
  knowledge_check: "Knowledge check",
  summary: "Summary",
};

export function LessonView({
  lessonId,
  lessonTitle,
  conceptName,
  scenes,
  showAnswers,
  codeLanguage = null,
  sessionId = null,
}: {
  lessonId?: string;
  lessonTitle?: string;
  conceptName?: string;
  scenes: PreviewScene[];
  showAnswers: boolean;
  codeLanguage?: string | null;
  sessionId?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const [inspectedEntity, setInspectedEntity] = useState<string | null>(null);
  const [inspectedLogs, setInspectedLogs] = useState<string | null>(null);

  const scene = scenes[index];
  const viewed = new Set(visited.filter((item) => item < scenes.length)).size;
  const trackerRef = useRef<ClassroomTracker | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    const tracker = new ClassroomTracker(lessonId, sessionId);
    trackerRef.current = tracker;

    tracker.emit("lesson_start", { sceneCount: scenes.length });
    if (scenes[0]) {
      tracker.emit("scene_view", {
        sceneIndex: 0,
        role: scenes[0].role,
        title: scenes[0].title,
      }, scenes[0].id);
    }

    const handleBeforeUnload = () => {
      tracker.flush();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      tracker.dispose();
    };
  }, [lessonId, sessionId, scenes]);

  function show(next: number) {
    const bounded = Math.max(0, Math.min(scenes.length - 1, next));
    if (bounded === index) return;
    const direction = bounded > index ? "next" : "prev";
    const nextScene = scenes[bounded];

    trackerRef.current?.emit("scene_nav", {
      fromIndex: index,
      toIndex: bounded,
      direction,
    }, scene?.id);

    if (nextScene) {
      trackerRef.current?.emit("scene_view", {
        sceneIndex: bounded,
        role: nextScene.role,
        title: nextScene.title,
      }, nextScene.id);
    }

    setIndex(bounded);
    setVisited((current) => {
      const nextVisited = current.includes(bounded) ? current : [...current, bounded];
      if (nextVisited.length === scenes.length) {
        trackerRef.current?.emit("lesson_complete", {
          scenesViewed: nextVisited.length,
          totalScenes: scenes.length,
        }, nextScene?.id);
      }
      return nextVisited;
    });
    setInspectedEntity(null);
    setInspectedLogs(null);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [role='textbox']")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
    }
  }

  if (!scene) {
    return <p className="max-w-[65ch] text-sm">No lesson content is stored yet. Generate scenes before previewing the student view.</p>;
  }

  return (
    <div
      className="grid min-w-0 gap-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:grid-cols-[16rem_minmax(0,1fr)]"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Lesson player. Left and right arrow keys move between scenes."
    >
      {/* Sidebar Outline Navigation */}
      <nav aria-label="Lesson outline" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:border-r lg:border-border/60 lg:pr-6 lg:pb-0">
        <div className="hidden lg:flex items-center justify-between pb-3 mb-1 border-b border-border/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lesson Outline
          </span>
          <span className="rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {scenes.length} scenes
          </span>
        </div>

        {scenes.map((item, itemIndex) => {
          const isActive = itemIndex === index;
          const isVisited = visited.includes(itemIndex);

          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "true" : undefined}
              aria-label={`Scene ${itemIndex + 1}: ${item.title}`}
              className={`group shrink-0 rounded-lg p-2.5 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
                isActive
                  ? "bg-primary/10 border-l-2 border-primary shadow-2xs font-medium"
                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => show(itemIndex)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isVisited
                        ? "bg-muted text-foreground border border-border/80"
                        : "bg-muted/40 text-muted-foreground border border-border/40"
                  }`}
                >
                  {itemIndex + 1}
                </span>
                <span className={`text-xs truncate ${isActive ? "text-foreground font-semibold" : ""}`}>
                  {item.title}
                </span>
              </div>
              <p className="mt-1 pl-7 text-[10px] text-muted-foreground truncate uppercase tracking-wider">
                {roleLabel[item.role] ?? "Scene"}
              </p>
            </button>
          );
        })}
      </nav>

      {/* Main Instructional Canvas */}
      <div className="min-w-0">
        {/* Top Progress & Header Bar */}
        <div className="rounded-xl border border-border/70 bg-card/50 p-4 shadow-2xs mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Scene {index + 1} of {scenes.length}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                · {roleLabel[scene.role] ?? "Lesson scene"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Viewed {viewed} of {scenes.length}. This is not a mastery score.
            </p>
          </div>
          <progress
            className="mt-3 h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary transition-all"
            max={scenes.length}
            value={viewed}
            aria-label="Scenes viewed in this sitting. This is not a mastery score."
          />
        </div>

        {/* Scene Instructional Content */}
        <article className="max-w-[80ch]">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-balance">{scene.title}</h2>
          <SceneBody
            lessonId={lessonId}
            scene={scene}
            showAnswers={showAnswers}
            codeLanguage={codeLanguage}
            onSelectEntity={(entity, logs) => {
              setInspectedEntity(entity);
              if (logs) setInspectedLogs(logs);
            }}
            onInspectNode={(nodeId, nodeLabel, category) => {
              trackerRef.current?.emit("diagram_node_inspect", { nodeId, nodeLabel, category }, scene.id);
            }}
            onStepperStep={(stepIndex, totalSteps, completed) => {
              trackerRef.current?.emit("stepper_step", { stepIndex, totalSteps, completed }, scene.id);
            }}
            onWalkthroughStep={(stepIndex, totalSteps) => {
              trackerRef.current?.emit("walkthrough_step", { stepIndex, totalSteps }, scene.id);
            }}
            onDockerLabAction={(action, status, passed) => {
              trackerRef.current?.emit("docker_lab_action", { action, status, passed }, scene.id);
            }}
            onCicdLabRun={(stage, stageName, passed, gateOutcome) => {
              trackerRef.current?.emit("cicd_lab_run", { stage, stageName, passed, gateOutcome }, scene.id);
            }}
            onK8sLabAction={(action, replicas, podName, outcome) => {
              trackerRef.current?.emit("k8s_lab_action", { action, replicas, podName, outcome }, scene.id);
            }}
            onQuizSubmit={(questionId, selectedOption, isCorrect) => {
              trackerRef.current?.emit("quiz_submit", { questionId, selectedOption, isCorrect }, scene.id);
            }}
            onQuizRetry={(questionId) => {
              trackerRef.current?.emit("quiz_retry", { questionId }, scene.id);
            }}
          />
        </article>

        {/* Bottom Scene Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground shadow-2xs hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 transition-colors"
              disabled={index === 0}
              onClick={() => show(index - 1)}
            >
              <span aria-hidden="true">&larr;</span> Previous
              <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground ml-1">
                [←]
              </span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 transition-colors"
              disabled={index === scenes.length - 1}
              onClick={() => show(index + 1)}
            >
              Next <span aria-hidden="true">&rarr;</span>
              <span className="hidden sm:inline font-mono text-[10px] text-primary-foreground/70 ml-1">
                [→]
              </span>
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Tip: Press arrow keys to navigate scenes
          </span>
        </div>
      </div>

      {/* Embedded Contextual AI Mentor */}
      <AiMentor
        lessonId={lessonId ?? scene.outlineId ?? "lesson"}
        lessonTitle={lessonTitle ?? scene.title}
        conceptName={conceptName ?? "DevOps & Software Delivery"}
        activeSceneTitle={scene.title}
        activeSceneRole={roleLabel[scene.role] ?? scene.role}
        selectedEntity={inspectedEntity}
        visibleLogs={inspectedLogs}
        onMentorOpen={(sceneTitle) => {
          trackerRef.current?.emit("mentor_open", { sceneTitle }, scene.id);
        }}
        onMentorAction={(action, promptCategory) => {
          trackerRef.current?.emit("mentor_action", { action, promptCategory }, scene.id);
        }}
        onMentorReply={(action, status) => {
          trackerRef.current?.emit("mentor_reply", { action, status }, scene.id);
        }}
      />
    </div>
  );
}

function SceneBody({
  lessonId,
  scene,
  showAnswers,
  codeLanguage,
  onSelectEntity,
  onInspectNode,
  onStepperStep,
  onWalkthroughStep,
  onDockerLabAction,
  onCicdLabRun,
  onK8sLabAction,
  onQuizSubmit,
  onQuizRetry,
}: {
  lessonId?: string;
  scene: PreviewScene;
  showAnswers: boolean;
  codeLanguage: string | null;
  onSelectEntity?: (entity: string | null, logs?: string | null) => void;
  onInspectNode?: (nodeId: string, nodeLabel: string, category?: string) => void;
  onStepperStep?: (stepIndex: number, totalSteps: number, completed: boolean) => void;
  onWalkthroughStep?: (stepIndex: number, totalSteps: number) => void;
  onDockerLabAction?: (action: "build" | "run" | "health_check" | "reset", status?: string, passed?: boolean) => void;
  onCicdLabRun?: (stage: number, stageName: string, passed: boolean, gateOutcome: "proceed" | "blocked") => void;
  onK8sLabAction?: (action: "scale" | "simulate_failure" | "recover" | "inspect_pod" | "reset", replicas?: number, podName?: string, outcome?: "degraded" | "recovered" | "scaled" | "normal") => void;
  onQuizSubmit?: (questionId: string, selectedOption: string, isCorrect: boolean) => void;
  onQuizRetry?: (questionId: string) => void;
}) {
  // 1. Interactive Diagram
  if (scene.diagram) {
    return (
      <div className="mt-4 space-y-4">
        {scene.paragraphs.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            {scene.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
        <ArchitectureDiagram
          data={scene.diagram}
          onSelectNode={(node) =>
            onSelectEntity?.(node ? `${node.label} (${node.category ?? "Node"})` : null)
          }
          onInspectNode={onInspectNode}
        />
      </div>
    );
  }

  // 2. Interactive Stepper
  if (scene.stepper) {
    return (
      <div className="mt-4 space-y-4">
        {scene.paragraphs.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            {scene.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
        <StepByStepViewer data={scene.stepper} onStepChange={onStepperStep} />
      </div>
    );
  }

  // 3. Interactive Code Walkthrough
  if (scene.walkthrough) {
    return (
      <div className="mt-4 space-y-4">
        {scene.paragraphs.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            {scene.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
        <CodeWalkthrough data={scene.walkthrough} onStepChange={onWalkthroughStep} />
      </div>
    );
  }

  // 4. Interactive Simulation Labs
  if (scene.lab) {
    return (
      <div className="mt-4 space-y-4">
        {scene.paragraphs.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            {scene.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
        {scene.lab.kind === "k8s" ? (
          <KubernetesLab
            onInspectEntity={(info) => {
              onSelectEntity?.(info.name, info.logs);
            }}
            onLabAction={onK8sLabAction}
          />
        ) : scene.lab.kind === "docker" ? (
          <DockerLab onLabAction={onDockerLabAction} />
        ) : scene.lab.kind === "cicd" ? (
          <CicdLab onPipelineRun={onCicdLabRun} />
        ) : (
          <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground">
            Simulation kind &apos;{JSON.stringify(scene.lab)}&apos; is preserved.
          </div>
        )}
      </div>
    );
  }

  // 5. Knowledge Check (Quiz)
  if (scene.role === "check" || scene.role === "knowledge_check" || scene.type === "quiz") {
    return (
      <div className="mt-4">
        <InteractiveKnowledgeCheck
          questions={scene.questions}
          lessonId={lessonId}
          showAnswers={showAnswers}
          onSubmitQuestion={onQuizSubmit}
          onRetryQuestion={onQuizRetry}
        />
      </div>
    );
  }

  // 6. Structured Content Blocks (Prose, Code, Steps, Comparison Table)
  if (scene.blocks.length > 0) {
    return (
      <div className="mt-4 space-y-4 text-sm text-pretty">
        {scene.blocks.map((block, blockIndex) => {
          if (block.kind === "code") {
            return (
              <CodeSample
                key={`${scene.id}-code-${blockIndex}`}
                code={block.code}
                language={block.language === "text" ? (codeLanguage ?? "text") : block.language}
              />
            );
          }
          if (block.kind === "steps") {
            return (
              <ol key={`${scene.id}-steps-${blockIndex}`} className="space-y-3">
                {block.steps.map((step, stepIndex) => (
                  <li key={step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                    <span className="font-mono text-muted-foreground">{stepIndex + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            );
          }
          if (block.kind === "comparison") {
            return (
              <div key={`${scene.id}-table-${blockIndex}`} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {block.headers.map((header) => (
                        <th key={header} className="border border-border px-3 py-2 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.join("|")}>
                        {row.map((cell) => (
                          <td key={cell} className="border border-border px-3 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          return <p key={`${scene.id}-prose-${blockIndex}`}>{block.text}</p>;
        })}
      </div>
    );
  }

  // 7. Explicit Fallback for unsupported or empty scenes
  return (
    <div className="mt-4 rounded-lg border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Content Preview</p>
      <p className="mt-1">
        This scene format has no visual blocks defined yet. You can edit this scene in Lesson Studio.
      </p>
    </div>
  );
}

function CodeSample({ code, language }: { code: string; language: string }) {
  const lines = Math.min(18, Math.max(4, code.split("\n").length + 1));
  const monacoLanguage = language === "cpp" ? "cpp" : language === "text" ? "plaintext" : language;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <p className="border-b border-border px-3 py-1.5 font-mono text-xs">
        {language === "text" ? "Example" : language}
      </p>
      <Editor
        height={`${lines * 20}px`}
        language={monacoLanguage}
        theme="vs"
        value={code}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          fontSize: 13,
          ariaLabel: "Code example",
        }}
      />
    </div>
  );
}
