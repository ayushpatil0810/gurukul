import { validateScene, type Action } from "@openmaic/dsl";
import {
  buildCompleteScene,
  generateSceneActions,
  generateSceneContent,
  generateSceneOutlinesFromRequirements,
  type AICallFn,
  type SceneOutline,
} from "@openmaic/generation";
import type { GeneratedSlideContent } from "@openmaic/generation";
import { AppError } from "@/lib/errors";
import { encodeLanguageDirective, languagePrompt, parseLanguageDirective, type LessonCodeLanguage } from "@/lib/engine/lesson-languages";
import { previewScenes } from "@/lib/engine/lesson-preview";
import { inspectScene } from "@/lib/engine/lesson-quality";
import { safeProviderMessage } from "@/lib/engine/lesson-provider";

export type LessonBrief = {
  topic: string;
  objectives: string;
  learnerLevel: string;
  durationMinutes: number;
  conceptName: string;
  moduleName: string;
  sourceMaterial: string;
  codeLanguage: LessonCodeLanguage;
};

export type StoredLessonScene = {
  id: string;
  outlineId: string;
  stageId: string;
  type: "slide" | "quiz" | "interactive";
  title: string;
  order: number;
  content: unknown;
  actions: unknown[];
  createdAt: number;
  updatedAt: number;
};

const failure = "The model output could not be saved. Nothing was published.";
const sceneAttempts = 2;

export function repairInstruction(messages: string[], samples: string[], language?: LessonCodeLanguage | null): string {
  const sample = samples.find((item) => item.trim().length > 0);
  const problems = messages.join(" ");
  const langName = language === "javascript" ? "JavaScript" : language === "typescript" ? "TypeScript" : "code";
  return sample ? `${problems} Replace this example with valid ${langName} and keep the explanation in English:\n${sample.slice(0, 400)}` : problems;
}

function normalizeQuizConfig(config: SceneOutline["quizConfig"]): SceneOutline["quizConfig"] {
  if (!config || !Array.isArray(config.questionTypes)) return undefined;
  const questionTypes = config.questionTypes
    .map((type) => {
      const name = type as string;
      if (name === "short_answer" || name === "short-answer") return "text" as const;
      return type;
    })
    .filter((type): type is "single" | "multiple" | "text" => type === "single" || type === "multiple" || type === "text");
  const unique = [...new Set(questionTypes)].slice(0, 3);
  const difficulty = config.difficulty === "easy" || config.difficulty === "hard" ? config.difficulty : "medium";
  const questionCount = Math.min(6, Math.max(1, Math.round(config.questionCount) || 1));
  return { questionCount, difficulty, questionTypes: unique.length > 0 ? unique : ["single"] };
}

/** Maps the DSL question type `short_answer` onto the outline contract's `text`. */
export function normalizeOutlineValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const outline = value as SceneOutline;
  return { ...outline, quizConfig: normalizeQuizConfig(outline.quizConfig) };
}

export function usableOutlines(outlines: SceneOutline[]): SceneOutline[] {
  const kept = outlines.filter((outline) => outline.type === "slide" || outline.type === "quiz");
  return kept.slice(0, 20).map((outline, index) => ({
    ...outline,
    title: outline.title.trim(),
    description: outline.description?.trim() || outline.title.trim(),
    keyPoints: (outline.keyPoints ?? []).map((point) => point.trim()).filter(Boolean).slice(0, 12),
    order: index + 1,
    quizConfig: normalizeQuizConfig(outline.quizConfig),
  })).filter((outline) => outline.title.length > 0);
}

export async function requestOutline(brief: LessonBrief, aiCall: AICallFn): Promise<{
  title: string;
  languageDirective: string;
  outlines: SceneOutline[];
}> {
  const requirement = [
    `Lesson topic: ${brief.topic}`,
    `Module: ${brief.moduleName}`,
    `Concept: ${brief.conceptName}`,
    `Learner level: ${brief.learnerLevel}`,
    `Length: about ${brief.durationMinutes} minutes`,
    `Learning objectives: ${brief.objectives}`,
    "Use only slide and quiz scenes.",
    "Do not create interactive, widget, simulation, or project-based scenes.",
    "Quiz scenes are ungraded knowledge checks. They are not coding assessments.",
    languagePrompt(brief.codeLanguage),
  ].join("\n");
  let result;
  try {
    result = await generateSceneOutlinesFromRequirements(
      { requirement, interactiveMode: false, taskEngineMode: false },
      brief.sourceMaterial || undefined,
      undefined,
      aiCall,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.badRequest("The lesson model could not be reached. Nothing was saved.");
  }
  if (!result.success || !result.data) {
    throw AppError.badRequest(safeProviderMessage(result.error) ?? "The lesson model did not return an outline. Nothing was saved.");
  }
  const outlines = usableOutlines(result.data.outlines);
  if (outlines.length === 0) {
    throw AppError.badRequest("The model did not return slide or quiz scenes. Nothing was saved.");
  }
  return {
    title: result.data.courseTitle?.trim() || brief.topic,
    languageDirective: encodeLanguageDirective(brief.codeLanguage),
    outlines,
  };
}

export async function requestScenes(
  outlines: SceneOutline[],
  stageId: string,
  aiCall: AICallFn,
  directive = encodeLanguageDirective("typescript"),
): Promise<StoredLessonScene[]> {
  const scenes: StoredLessonScene[] = [];
  for (const outline of usableOutlines(outlines)) {
    scenes.push(await requestOneScene(outline, stageId, aiCall, directive));
  }
  if (scenes.length === 0) throw AppError.badRequest(failure);
  return scenes;
}

export async function requestOneScene(
  outline: SceneOutline,
  stageId: string,
  aiCall: AICallFn,
  directive: string,
): Promise<StoredLessonScene> {
  const language = parseLanguageDirective(directive);
  const prompt = language.code ? languagePrompt(language.code) : "Write every heading and explanation in English.";
  let editDirective: string | undefined;
  let baseline: GeneratedSlideContent | undefined;
  let lastProblem = "The scene did not pass validation.";
  for (let attempt = 1; attempt <= sceneAttempts; attempt += 1) {
    let content;
    try {
      content = await generateSceneContent(outline, aiCall, {
        languageDirective: `${prompt} ${editDirective ?? ""}`.trim(),
        editDirective,
        baselineContent: baseline,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.badRequest("The lesson model could not be reached. The draft was not changed.");
    }
    if (!content || !("elements" in content || "questions" in content) || "html" in content || "projectV2" in content) {
      lastProblem = `The scene “${outline.title.slice(0, 80)}” did not return slide or quiz content.`;
      editDirective = lastProblem;
      continue;
    }
    if ("elements" in content) baseline = content;
    let actions: Action[] = [];
    try {
      actions = await generateSceneActions(outline, content, aiCall);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.badRequest("The lesson model could not be reached. The draft was not changed.");
    }
    const scene = buildCompleteScene(outline, content, actions, stageId, { sceneId: outline.id });
    if (!scene || (scene.type !== "slide" && scene.type !== "quiz")) {
      lastProblem = `The scene “${outline.title.slice(0, 80)}” could not be assembled.`;
      editDirective = lastProblem;
      continue;
    }
    const validation = validateScene(scene);
    if (!validation.valid) {
      const issue = validation.errors[0];
      const detail = issue ? `${issue.path} ${issue.message}` : "The scene did not match the lesson format.";
      lastProblem = `The scene “${outline.title.slice(0, 80)}” did not pass validation: ${detail.slice(0, 180)}`;
      editDirective = lastProblem;
      continue;
    }
    const stored = {
      id: scene.id,
      outlineId: scene.outlineId,
      stageId: scene.stageId,
      type: scene.type,
      title: scene.title,
      order: scene.order,
      content: scene.content,
      actions: scene.actions ?? [],
      createdAt: scene.createdAt ?? Date.now(),
      updatedAt: scene.updatedAt ?? Date.now(),
    } satisfies StoredLessonScene;
    const preview = previewScenes([stored], false, language.code);
    const blocking = preview.flatMap((item) => inspectScene(item, language.code).filter((issue) => issue.severity === "error"));
    if (blocking.length === 0) return stored;
    const samples = preview.flatMap((item) => item.blocks.flatMap((block) => (block.kind === "code" ? [block.code] : [])));
    const instruction = repairInstruction(
      blocking.map((issue) => issue.message),
      samples,
      language.code,
    );
    lastProblem = `The scene “${outline.title.slice(0, 80)}”: ${instruction}`;
    editDirective = instruction;
  }
  throw AppError.badRequest(`${lastProblem} The draft was not changed.`);
}
