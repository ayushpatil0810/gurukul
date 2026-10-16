"use client";

import { useEffect, useState } from "react";
import { LessonView } from "@/components/lessons/lesson-view";
import { Button } from "@/components/ui/button";
import type { LessonCodeLanguage } from "@/lib/engine/lesson-languages";
import type { LessonAuthorView } from "@/lib/services/lessons";

type OutlineDraft = {
  id: string;
  type: "slide" | "quiz" | "interactive";
  title: string;
  description: string;
  keyPoints: string;
  quizConfig?: LessonAuthorView["outlines"][number]["quizConfig"];
};

export function LessonEditor({ lesson }: { lesson: LessonAuthorView }) {
  const [view, setView] = useState(lesson);
  const [outlines, setOutlines] = useState<OutlineDraft[]>(() => toDrafts(lesson));
  const [bodies, setBodies] = useState<Record<string, string>>(() => bodyMap(lesson));
  const [codeLanguage, setCodeLanguage] = useState<LessonCodeLanguage | "">(lesson.codeLanguage ?? "");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function adopt(next: LessonAuthorView, message: string) {
    setView(next);
    setOutlines(toDrafts(next));
    setBodies(bodyMap(next));
    setCodeLanguage(next.codeLanguage ?? "");
    setNotice(message);
    setError("");
  }

  async function send(action: string, path: string, method: "PATCH" | "POST", payload: unknown, message: string) {
    setPending(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { data?: LessonAuthorView; error?: { message?: string } };
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "The lesson was not changed.");
        return;
      }
      adopt(body.data, message);
    } catch {
      setError("The lesson was not changed.");
    } finally {
      setPending("");
    }
  }

  const busy = pending.length > 0;
  const errors = view.issues.filter((issue) => issue.severity === "error");
  const warnings = view.issues.filter((issue) => issue.severity === "warning");
  const dirty = outlines.some((outline, index) => {
    const saved = view.outlines[index];
    return !saved || outline.title !== saved.title || outline.description !== saved.description || outline.keyPoints !== (saved.keyPoints ?? []).join("\n");
  }) || codeLanguage !== (view.codeLanguage ?? "");

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const stage = pending === "content" || pending.startsWith("scene:")
    ? "Generating scene content."
    : view.scenes.length === 0
      ? "Review the outline, then generate scene content."
      : errors.length > 0
        ? "Fix the validation errors before publishing."
        : view.status === "published"
          ? "Published. Students on the recommended concept can open it."
          : "Preview the student view, then publish.";

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm">
          {view.moduleName} · {view.conceptName}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance">{view.title}</h1>
        <p className="mt-2 max-w-[65ch] text-sm">{stage}</p>
        <p className="mt-1 text-sm">{view.status === "published" ? "Published" : "Draft"}. Opening a lesson does not change mastery.</p>
        <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <li>1. Requirements</li>
          <li aria-current={view.scenes.length === 0 ? "step" : undefined}>2. Outline</li>
          <li aria-current={view.scenes.length > 0 ? "step" : undefined}>3. Scenes and preview</li>
          <li>4. Publish</li>
        </ol>
      </header>
      <section className="max-w-[65ch] space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Outline</h2>
        <label className="block text-sm" htmlFor="code-language">
          Programming language for examples
          <select
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            id="code-language"
            value={codeLanguage}
            onChange={(event) => setCodeLanguage(event.target.value as LessonCodeLanguage | "")}
          >
            <option value="">Not recorded</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java, syntax not checked</option>
            <option value="cpp">C++, syntax not checked</option>
          </select>
        </label>
        <p className="text-sm">Explanations stay in English. Assessment execution is a separate list: Java, JavaScript, and C++.</p>
        {outlines.map((outline, index) => (
          <div key={outline.id} className="space-y-2 border-t border-border pt-4">
            <label className="block text-sm" htmlFor={`title-${outline.id}`}>
              Scene {index + 1} title
              <input
                className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                id={`title-${outline.id}`}
                value={outline.title}
                onChange={(event) => updateOutline(index, { title: event.target.value })}
              />
            </label>
            <label className="block text-sm" htmlFor={`type-${outline.id}`}>
              Type
              <select
                className="mt-1 block rounded-md border border-border bg-background px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                id={`type-${outline.id}`}
                value={outline.type}
                onChange={(event) => updateOutline(index, { type: event.target.value === "quiz" ? "quiz" : "slide" })}
              >
                <option value="slide">Slide</option>
                <option value="quiz">Knowledge check</option>
              </select>
            </label>
            <label className="block text-sm" htmlFor={`description-${outline.id}`}>
              Description
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                id={`description-${outline.id}`}
                value={outline.description}
                onChange={(event) => updateOutline(index, { description: event.target.value })}
              />
            </label>
            <label className="block text-sm" htmlFor={`points-${outline.id}`}>
              Key points, one per line
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                id={`points-${outline.id}`}
                value={outline.keyPoints}
                onChange={(event) => updateOutline(index, { keyPoints: event.target.value })}
              />
            </label>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={busy} onClick={() => send("outline", `/api/lessons/${view.id}`, "PATCH", outlinePayload(), "Outline saved.")}>
            {pending === "outline" ? "Saving…" : "Save outline"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || view.status === "published"}
            onClick={() => send("content", `/api/lessons/${view.id}/content`, "POST", { version: view.version }, "Lesson content generated. It is still a draft.")}
          >
            {pending === "content" ? "Generating…" : "Generate content"}
          </Button>
        </div>
        {view.status === "published" ? (
          <p className="text-sm">A published lesson is not regenerated as a whole. Repair or regenerate one scene, then publish again only if validation passes.</p>
        ) : null}
      </section>
      <section>
        <h2 className="text-xl font-semibold tracking-tight">Preview</h2>
        <p className="mt-2 max-w-[65ch] text-sm text-pretty">
          This preview is the student player. Knowledge checks are not graded, and generated code is not run.
        </p>
        <div className="mt-4">
          <LessonView
            lessonId={view.id}
            lessonTitle={view.title}
            conceptName={view.conceptName}
            scenes={view.scenes}
            showAnswers
            codeLanguage={view.codeLanguage}
          />
        </div>
        {view.scenes.length > 0 ? (
          <div className="mt-6 max-w-[65ch] space-y-4">
            {view.scenes.map((scene) => (
              <div key={scene.id} className="space-y-2">
                <label className="block text-sm" htmlFor={`body-${scene.id}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span>Edit text for {scene.title}</span>
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                      {scene.role}
                    </span>
                  </span>
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    id={`body-${scene.id}`}
                    value={bodies[scene.id] ?? scene.paragraphs.join("\n\n")}
                    onChange={(event) => setBodies((current) => ({ ...current, [scene.id]: event.target.value }))}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    send(
                      `scene:${scene.id}`,
                      `/api/lessons/${view.id}/content`,
                      "POST",
                      { version: view.version, outlineId: scene.outlineId },
                      view.status === "published"
                        ? "That scene was generated again."
                        : "That scene was generated again. The lesson stays a draft until you publish it.",
                    )
                  }
                >
                  {pending === `scene:${scene.id}` ? "Generating this scene…" : "Regenerate this scene"}
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={busy} onClick={() => send("scenes", `/api/lessons/${view.id}`, "PATCH", scenePayload(), "Edits saved.")}>
                {pending === "scenes" ? "Saving…" : "Save edits"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || errors.length > 0}
                aria-describedby="lesson-validation"
                onClick={() => send("publish", `/api/lessons/${view.id}/publish`, "POST", { version: view.version }, "Published. Students on this concept can open it.")}
              >
                {pending === "publish" ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      <section className="max-w-[65ch]" id="lesson-validation" aria-live="polite">
        <h2 className="text-xl font-semibold tracking-tight">Validation</h2>
        {view.scenes.length === 0 ? <p className="mt-2 text-sm">Generate content before language and code checks can run.</p> : null}
        {errors.length === 0 && warnings.length === 0 && view.scenes.length > 0 ? (
          <p className="mt-2 text-sm">No blocking problems are stored.</p>
        ) : null}
        {errors.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {errors.map((issue) => (
              <li key={`${issue.sceneId}-${issue.message}`}>
                Blocking, {issue.sceneTitle}: {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {warnings.map((issue) => (
              <li key={`${issue.sceneId}-warn-${issue.message}`}>
                Warning, {issue.sceneTitle}: {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {error ? (
        <p className="text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );

  function updateOutline(index: number, patch: Partial<OutlineDraft>) {
    setOutlines((current) => current.map((outline, item) => (item === index ? { ...outline, ...patch } : outline)));
  }

  function outlinePayload() {
    return {
      version: view.version,
      outlines: outlines.map((outline, index) => ({
        id: outline.id,
        type: outline.type,
        title: outline.title,
        description: outline.description,
        keyPoints: outline.keyPoints.split("\n").map((point) => point.trim()).filter(Boolean),
        order: index + 1,
        quizConfig: outline.quizConfig,
      })),
      codeLanguage: codeLanguage || undefined,
    };
  }

  function scenePayload() {
    return {
      version: view.version,
      scenes: view.scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        body: bodies[scene.id] ?? scene.paragraphs.join("\n\n"),
        questions: scene.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          options: question.options,
        })),
      })),
    };
  }
}

function toDrafts(lesson: LessonAuthorView): OutlineDraft[] {
  return lesson.outlines.map((outline) => ({
    id: outline.id,
    type: outline.type === "quiz" ? "quiz" : (outline.type as string) === "interactive" ? "interactive" : "slide",
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints ?? []).join("\n"),
    quizConfig: outline.quizConfig,
  }));
}

function bodyMap(lesson: LessonAuthorView): Record<string, string> {
  return Object.fromEntries(lesson.scenes.map((scene) => [scene.id, scene.paragraphs.join("\n\n")]));
}
