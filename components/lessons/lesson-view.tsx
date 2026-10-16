"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { PreviewScene, SceneRole } from "@/lib/engine/lesson-preview";
import { ArchitectureDiagram } from "@/components/lessons/interactive/architecture-diagram";
import { StepByStepViewer } from "@/components/lessons/interactive/step-by-step";
import { CodeWalkthrough } from "@/components/lessons/interactive/code-walkthrough";
import { KubernetesLab } from "@/components/lessons/interactive/kubernetes-lab";
import { DockerLab } from "@/components/lessons/interactive/docker-lab";
import { CicdLab } from "@/components/lessons/interactive/cicd-lab";
import { InteractiveKnowledgeCheck } from "@/components/lessons/interactive/interactive-quiz";
import { AiMentor } from "@/components/lessons/mentor/ai-mentor";

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
}: {
  lessonId?: string;
  lessonTitle?: string;
  conceptName?: string;
  scenes: PreviewScene[];
  showAnswers: boolean;
  codeLanguage?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const [inspectedEntity, setInspectedEntity] = useState<string | null>(null);
  const [inspectedLogs, setInspectedLogs] = useState<string | null>(null);

  const scene = scenes[index];
  const viewed = new Set(visited.filter((item) => item < scenes.length)).size;

  function show(next: number) {
    const bounded = Math.max(0, Math.min(scenes.length - 1, next));
    setIndex(bounded);
    setVisited((current) => (current.includes(bounded) ? current : [...current, bounded]));
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
      className="grid min-w-0 gap-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:grid-cols-[15rem_minmax(0,1fr)]"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Lesson player. Left and right arrow keys move between scenes."
    >
      <nav aria-label="Lesson outline" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {scenes.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            aria-current={itemIndex === index ? "true" : undefined}
            aria-label={`Scene ${itemIndex + 1}: ${item.title}`}
            className={`shrink-0 rounded-md px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              itemIndex === index ? "bg-secondary font-medium" : "hover:bg-secondary"
            }`}
            onClick={() => show(itemIndex)}
          >
            <span>{itemIndex + 1}</span> {item.title}
          </button>
        ))}
      </nav>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm">
            Scene {index + 1} of {scenes.length}
            <span className="mx-2 text-muted-foreground">·</span>
            {roleLabel[scene.role] ?? "Lesson scene"}
          </p>
          <p className="text-sm">
            Viewed {viewed} of {scenes.length}. This is not a mastery score.
          </p>
        </div>
        <progress
          className="mt-3 h-1.5 w-full appearance-none overflow-hidden rounded-full bg-secondary [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-foreground"
          max={scenes.length}
          value={viewed}
          aria-label="Scenes viewed in this sitting. This is not a mastery score."
        />
        <article className="mt-6 max-w-[75ch]">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">{scene.title}</h2>
          <SceneBody
            scene={scene}
            showAnswers={showAnswers}
            codeLanguage={codeLanguage}
            onSelectEntity={(entity, logs) => {
              setInspectedEntity(entity);
              if (logs) setInspectedLogs(logs);
            }}
          />
        </article>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
            disabled={index === 0}
            onClick={() => show(index - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
            disabled={index === scenes.length - 1}
            onClick={() => show(index + 1)}
          >
            Next
          </button>
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
      />
    </div>
  );
}

function SceneBody({
  scene,
  showAnswers,
  codeLanguage,
  onSelectEntity,
}: {
  scene: PreviewScene;
  showAnswers: boolean;
  codeLanguage: string | null;
  onSelectEntity?: (entity: string | null, logs?: string | null) => void;
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
        <StepByStepViewer data={scene.stepper} />
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
        <CodeWalkthrough data={scene.walkthrough} />
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
          />
        ) : scene.lab.kind === "docker" ? (
          <DockerLab />
        ) : scene.lab.kind === "cicd" ? (
          <CicdLab />
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
        <InteractiveKnowledgeCheck questions={scene.questions} showAnswers={showAnswers} />
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
