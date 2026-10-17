import { and, asc, desc, eq } from "drizzle-orm";
import { validateScene } from "@openmaic/dsl";
import type { AICallFn, SceneOutline } from "@openmaic/generation";
import { db } from "@/db";
import { batchTrainers, concepts, lessons, masteryState, moduleConcepts, modules } from "@/db/schema";
import { assertActorRole, type Actor } from "@/lib/auth/actor";
import { normalizeOutlineValue, requestOneScene, requestOutline, requestScenes, usableOutlines, type StoredLessonScene } from "@/lib/engine/lesson-generation";
import { applyPhraseRepair, type PhraseRepair } from "@/lib/engine/lesson-repair";
import { encodeLanguageDirective, parseLanguageDirective, type LessonCodeLanguage } from "@/lib/engine/lesson-languages";
import { escapeLessonText, previewScenes, type PreviewScene } from "@/lib/engine/lesson-preview";
import { inspectLesson, type LessonIssue } from "@/lib/engine/lesson-quality";
import { callLessonModel, lessonModelConfigured } from "@/lib/engine/lesson-provider";
import { AppError } from "@/lib/errors";
import { previewRoute } from "@/lib/services/assessment";
import { outlineSceneSchema, type createLessonSchema } from "@/lib/validations/lessons";
import type { z } from "zod";

type CreateLessonInput = z.infer<typeof createLessonSchema>;

export type LessonAuthorView = {
  id: string;
  title: string;
  topic: string;
  objectives: string;
  learnerLevel: string;
  durationMinutes: number;
  sourceMaterial: string;
  status: "draft" | "published";
  version: number;
  moduleId: string;
  moduleName: string;
  conceptId: string;
  conceptName: string;
  codeLanguage: LessonCodeLanguage | null;
  issues: LessonIssue[];
  outlines: SceneOutline[];
  scenes: PreviewScene[];
};

export type LessonStudentView = {
  id: string;
  title: string;
  conceptName: string;
  codeLanguage: LessonCodeLanguage | null;
  scenes: PreviewScene[];
};

function formatStatus(status: string): "draft" | "published" {
  return status === "published" ? "published" : "draft";
}

async function authorInstitute(actor: Actor): Promise<string> {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = actor.instituteId;
  if (!instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  if (actor.role === "trainer") {
    const [batch] = await db
      .select({ batchId: batchTrainers.batchId })
      .from(batchTrainers)
      .where(and(eq(batchTrainers.trainerId, actor.id), eq(batchTrainers.instituteId, instituteId)))
      .limit(1);
    if (!batch) throw AppError.forbidden("You are not assigned to a batch in this institute");
  }
  return instituteId;
}

async function placement(instituteId: string, moduleId: string, conceptId: string) {
  const [moduleRow] = await db
    .select({ id: modules.id, name: modules.name })
    .from(modules)
    .where(and(eq(modules.id, moduleId), eq(modules.instituteId, instituteId)))
    .limit(1);
  if (!moduleRow) throw AppError.notFound("Module not found");
  const [concept] = await db
    .select({ id: concepts.id, name: concepts.name })
    .from(moduleConcepts)
    .innerJoin(concepts, eq(concepts.id, moduleConcepts.conceptId))
    .where(
      and(
        eq(moduleConcepts.moduleId, moduleId),
        eq(moduleConcepts.conceptId, conceptId),
        eq(moduleConcepts.instituteId, instituteId),
      ),
    )
    .limit(1);
  if (!concept) throw AppError.notFound("Concept not found");
  return { module: moduleRow, concept };
}

function parseOutlines(value: unknown): SceneOutline[] {
  if (!Array.isArray(value)) throw AppError.badRequest("This lesson has no outline to generate from.");
  const outlines: SceneOutline[] = [];
  for (const item of value) {
    const parsed = outlineSceneSchema.safeParse(normalizeOutlineValue(item));
    if (!parsed.success) throw AppError.badRequest("The saved outline is not valid. Edit it before generating.");
    outlines.push(parsed.data);
  }
  const usable = usableOutlines(outlines);
  if (usable.length === 0) throw AppError.badRequest("The saved outline has no slide or quiz scenes.");
  return usable;
}

async function loadOwned(actor: Actor, lessonId: string) {
  const instituteId = await authorInstitute(actor);
  const [row] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!row || row.instituteId !== instituteId) throw AppError.notFound("Lesson not found");
  return row;
}

function expectVersion(current: number, version: number) {
  if (current !== version) {
    throw AppError.conflict("This lesson was saved somewhere else. Reload it and try again.");
  }
}

async function toAuthorView(row: typeof lessons.$inferSelect): Promise<LessonAuthorView> {
  const [moduleRow] = await db.select({ name: modules.name }).from(modules).where(eq(modules.id, row.moduleId)).limit(1);
  const [concept] = await db.select({ name: concepts.name }).from(concepts).where(eq(concepts.id, row.conceptId)).limit(1);
  const language = parseLanguageDirective(row.languageDirective);
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    objectives: row.objectives,
    learnerLevel: row.learnerLevel,
    durationMinutes: row.durationMinutes,
    sourceMaterial: row.sourceMaterial,
    status: formatStatus(row.status),
    version: row.version,
    moduleId: row.moduleId,
    moduleName: moduleRow?.name ?? "Module",
    conceptId: row.conceptId,
    conceptName: concept?.name ?? "Concept",
    codeLanguage: language.code,
    issues: inspectLesson(row.scenesJson, row.languageDirective),
    outlines: parseOutlines(row.outlineJson),
    scenes: previewScenes(row.scenesJson, true, language.code),
  };
}

export async function listLessons(actor: Actor) {
  const instituteId = await authorInstitute(actor);
  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      topic: lessons.topic,
      learnerLevel: lessons.learnerLevel,
      durationMinutes: lessons.durationMinutes,
      status: lessons.status,
      languageDirective: lessons.languageDirective,
      outlineJson: lessons.outlineJson,
      scenesJson: lessons.scenesJson,
      updatedAt: lessons.updatedAt,
      moduleName: modules.name,
      conceptName: concepts.name,
    })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(concepts, eq(concepts.id, lessons.conceptId))
    .where(eq(lessons.instituteId, instituteId))
    .orderBy(desc(lessons.updatedAt));

  return rows.map((row) => {
    const outlines = Array.isArray(row.outlineJson) ? row.outlineJson : [];
    const scenes = Array.isArray(row.scenesJson) ? row.scenesJson : [];
    const language = parseLanguageDirective(row.languageDirective);
    return {
      id: row.id,
      title: row.title,
      topic: row.topic,
      learnerLevel: row.learnerLevel,
      durationMinutes: row.durationMinutes,
      status: formatStatus(row.status),
      moduleName: row.moduleName,
      conceptName: row.conceptName,
      codeLanguage: language.code || null,
      scenesCount: scenes.length > 0 ? scenes.length : outlines.length,
      hasScenes: scenes.length > 0,
      updatedAt: row.updatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC",
    };
  });
}

function requireModel(aiCall: AICallFn) {
  if (aiCall === callLessonModel && !lessonModelConfigured()) {
    throw AppError.badRequest("Lesson generation needs OPENAI_API_KEY. Nothing was saved. The rest of the portal still works.");
  }
}

export async function createLesson(actor: Actor, input: CreateLessonInput, aiCall: AICallFn = callLessonModel) {
  const instituteId = await authorInstitute(actor);
  requireModel(aiCall);
  const place = await placement(instituteId, input.moduleId, input.conceptId);
  const generated = await requestOutline(
    {
      topic: input.topic,
      objectives: input.objectives,
      learnerLevel: input.learnerLevel,
      durationMinutes: input.durationMinutes,
      conceptName: place.concept.name,
      moduleName: place.module.name,
      sourceMaterial: input.sourceMaterial?.trim() ?? "",
      codeLanguage: input.codeLanguage ?? "typescript",
    },
    aiCall,
  );
  const outlines = [];
  for (const outline of generated.outlines) {
    const parsed = outlineSceneSchema.safeParse(outline);
    if (!parsed.success) {
      throw AppError.badRequest("The model did not return slide or quiz scenes. Nothing was saved.");
    }
    outlines.push(parsed.data);
  }
  const [row] = await db
    .insert(lessons)
    .values({
      instituteId,
      moduleId: place.module.id,
      conceptId: place.concept.id,
      createdBy: actor.id,
      title: generated.title.slice(0, 160),
      topic: input.topic,
      objectives: input.objectives,
      learnerLevel: input.learnerLevel,
      durationMinutes: input.durationMinutes,
      sourceMaterial: input.sourceMaterial?.trim() ?? "",
      status: "draft",
      languageDirective: generated.languageDirective,
      outlineJson: outlines,
      scenesJson: null,
    })
    .returning();
  if (!row) throw AppError.badRequest("The lesson could not be saved.");
  return toAuthorView(row);
}

export async function readLessonForAuthor(actor: Actor, lessonId: string) {
  return toAuthorView(await loadOwned(actor, lessonId));
}

export async function readLessonForStudent(
  actor: Actor,
  lessonId: string,
  options?: { allowAllPublished?: boolean },
): Promise<LessonStudentView> {
  if (actor.role !== "student" || !actor.instituteId) throw AppError.forbidden("Lessons are opened from your own dashboard");
  const [row] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!row || row.instituteId !== actor.instituteId || row.status !== "published") {
    throw AppError.notFound("Lesson not found");
  }
  if (!options?.allowAllPublished) {
    let recommended: string;
    try {
      recommended = (await previewRoute(actor.id, actor.instituteId)).decision.conceptId;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) throw AppError.notFound("Lesson not found");
      throw error;
    }
    if (row.conceptId !== recommended) throw AppError.notFound("Lesson not found");
  }
  const [concept] = await db.select({ name: concepts.name }).from(concepts).where(eq(concepts.id, row.conceptId)).limit(1);
  const language = parseLanguageDirective(row.languageDirective);
  return {
    id: row.id,
    title: row.title,
    conceptName: concept?.name ?? "Concept",
    codeLanguage: language.code,
    scenes: previewScenes(row.scenesJson, false, language.code),
  };
}

export async function publishedLessonForConcept(instituteId: string, conceptId: string) {
  const [row] = await db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .where(and(eq(lessons.instituteId, instituteId), eq(lessons.conceptId, conceptId), eq(lessons.status, "published")))
    .orderBy(desc(lessons.publishedAt))
    .limit(1);
  return row ?? null;
}

export async function saveOutline(
  actor: Actor,
  lessonId: string,
  version: number,
  outlines: SceneOutline[],
  codeLanguage?: LessonCodeLanguage,
) {
  const row = await loadOwned(actor, lessonId);
  expectVersion(row.version, version);
  const usable = usableOutlines(outlines);
  if (usable.length === 0) throw AppError.badRequest("Keep at least one slide or quiz scene.");
  const [updated] = await db
    .update(lessons)
    .set({
      outlineJson: usable,
      languageDirective: codeLanguage ? encodeLanguageDirective(codeLanguage) : row.languageDirective,
      version: row.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(lessons.id, row.id), eq(lessons.version, version)))
    .returning();
  if (!updated) throw AppError.conflict("This lesson was saved somewhere else. Reload it and try again.");
  return toAuthorView(updated);
}

export async function generateLessonContent(
  actor: Actor,
  lessonId: string,
  version: number,
  aiCall: AICallFn = callLessonModel,
  outlineId?: string,
) {
  const row = await loadOwned(actor, lessonId);
  requireModel(aiCall);
  expectVersion(row.version, version);
  const outlines = parseOutlines(row.outlineJson);
  const directive = row.languageDirective || encodeLanguageDirective("typescript");
  const previous = Array.isArray(row.scenesJson) ? (row.scenesJson as StoredLessonScene[]) : [];
  const scenes = outlineId
    ? replaceScene(previous, outlines, outlineId, await requestOneScene(requiredOutline(outlines, outlineId), row.id, aiCall, directive))
    : await requestScenes(outlines, row.id, aiCall, directive);
  if (row.status === "published") assertNoBlocking(scenes, directive, "Cannot change the published lesson.");
  const [updated] = await db
    .update(lessons)
    .set({ scenesJson: scenes, version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(lessons.id, row.id), eq(lessons.version, version), eq(lessons.status, row.status)))
    .returning();
  if (!updated) throw AppError.conflict("This lesson was saved somewhere else. Reload it and try again.");
  return toAuthorView(updated);
}

function requiredOutline(outlines: SceneOutline[], outlineId: string): SceneOutline {
  const outline = outlines.find((item) => item.id === outlineId);
  if (!outline) throw AppError.badRequest("That scene is not in the outline.");
  return outline;
}

function replaceScene(previous: StoredLessonScene[], outlines: SceneOutline[], outlineId: string, next: StoredLessonScene): StoredLessonScene[] {
  const order = new Map(outlines.map((outline) => [outline.id, outline.order]));
  const replaced = previous.some((scene) => scene.outlineId === outlineId || scene.id === outlineId)
    ? previous.map((scene) => (scene.outlineId === outlineId || scene.id === outlineId ? next : scene))
    : [...previous, next];
  return replaced
    .map((scene) => ({ ...scene, order: order.get(scene.outlineId) ?? scene.order }))
    .sort((left, right) => left.order - right.order);
}

function applyEdits(scenes: StoredLessonScene[], edits: { id: string; title: string; body: string; questions: { id: string; prompt: string; options: string[] }[] }[]) {
  const byId = new Map(edits.map((edit) => [edit.id, edit]));
  return scenes.map((scene) => {
    const edit = byId.get(scene.id);
    if (!edit) return scene;
    const next = structuredClone(scene);
    next.title = edit.title;
    next.updatedAt = Date.now();
    const content = next.content;
    if (!content || typeof content !== "object") return next;
    if (next.type === "slide" && "canvas" in content && content.canvas && typeof content.canvas === "object") {
      const canvas = content.canvas as { elements?: { type?: string; content?: string }[] };
      const text = canvas.elements?.find((element) => element.type === "text");
      if (text) text.content = `<p>${escapeLessonText(edit.body)}</p>`;
    }
    if (next.type === "interactive" && "type" in content) {
      (content as Record<string, unknown>).description = edit.body;
      if ("widgetConfig" in content && content.widgetConfig && typeof content.widgetConfig === "object") {
        (content.widgetConfig as Record<string, unknown>).description = edit.body;
      }
    }
    if (next.type === "quiz" && "questions" in content && Array.isArray(content.questions)) {
      for (const question of content.questions) {
        if (!question || typeof question !== "object" || !("id" in question) || typeof question.id !== "string") continue;
        const match = edit.questions.find((item) => item.id === question.id);
        if (!match || !("question" in question)) continue;
        question.question = match.prompt;
        if ("options" in question && Array.isArray(question.options)) {
          for (const [index, option] of question.options.entries()) {
            if (option && typeof option === "object" && "label" in option && match.options[index]) {
              option.label = match.options[index];
            }
          }
        }
      }
    }
    if (!validateScene(next).valid) throw AppError.badRequest("The edited scene is not valid. Nothing was published.");
    return next;
  });
}

export async function saveSceneEdits(
  actor: Actor,
  lessonId: string,
  version: number,
  edits: { id: string; title: string; body: string; questions: { id: string; prompt: string; options: string[] }[] }[],
) {
  const row = await loadOwned(actor, lessonId);
  expectVersion(row.version, version);
  if (!Array.isArray(row.scenesJson) || row.scenesJson.length === 0) {
    throw AppError.badRequest("Generate lesson content before editing scenes.");
  }
  const scenes = applyEdits(row.scenesJson as StoredLessonScene[], edits);
  if (row.status === "published") assertNoBlocking(scenes, row.languageDirective, "Cannot change the published lesson.");
  const [updated] = await db
    .update(lessons)
    .set({ scenesJson: scenes, version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(lessons.id, row.id), eq(lessons.version, version)))
    .returning();
  if (!updated) throw AppError.conflict("This lesson was saved somewhere else. Reload it and try again.");
  return toAuthorView(updated);
}

export async function saveRepairedLesson(
  actor: Actor,
  lessonId: string,
  version: number,
  repairs: { sceneId: string; phrases: PhraseRepair[] }[],
  codeLanguage: LessonCodeLanguage,
) {
  const row = await loadOwned(actor, lessonId);
  expectVersion(row.version, version);
  if (!Array.isArray(row.scenesJson) || row.scenesJson.length === 0) {
    throw AppError.badRequest("Generate lesson content before repairing a scene. Nothing was saved.");
  }
  let scenes = row.scenesJson as StoredLessonScene[];
  for (const repair of repairs) {
    const applied = applyPhraseRepair(scenes, repair.sceneId, repair.phrases);
    if (!applied.ok) throw AppError.badRequest(`${applied.reason} Nothing was saved.`);
    scenes = applied.scenes;
  }
  for (const scene of scenes) {
    if (!validateScene(scene).valid) throw AppError.badRequest("The repaired scene is not valid. Nothing was saved.");
  }
  const directive = encodeLanguageDirective(codeLanguage);
  assertNoBlocking(scenes, directive, "Cannot store the repaired lesson.");
  const [updated] = await db
    .update(lessons)
    .set({ scenesJson: scenes, languageDirective: directive, version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(lessons.id, row.id), eq(lessons.version, version), eq(lessons.status, row.status)))
    .returning();
  if (!updated) throw AppError.conflict("This lesson was saved somewhere else. Reload it and try again.");
  return toAuthorView(updated);
}

function assertNoBlocking(scenes: unknown, directive: string, prefix: string) {
  const blocking = inspectLesson(scenes, directive).filter((issue) => issue.severity === "error");
  if (blocking[0]) throw AppError.badRequest(`${prefix} “${blocking[0].sceneTitle}”: ${blocking[0].message} Nothing was saved.`);
}

export async function publishLesson(actor: Actor, lessonId: string, version: number) {
  const row = await loadOwned(actor, lessonId);
  expectVersion(row.version, version);
  if (!Array.isArray(row.scenesJson) || row.scenesJson.length === 0) {
    throw AppError.badRequest("Generate lesson content before publishing.");
  }
  const blocking = inspectLesson(row.scenesJson, row.languageDirective).filter((issue) => issue.severity === "error");
  if (blocking[0]) {
    throw AppError.badRequest(`Cannot publish “${blocking[0].sceneTitle}”: ${blocking[0].message}`);
  }
  const [updated] = await db
    .update(lessons)
    .set({ status: "published", publishedAt: new Date(), version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(lessons.id, row.id), eq(lessons.version, version)))
    .returning();
  if (!updated) throw AppError.conflict("This lesson was saved somewhere else. Reload it and try again.");
  return toAuthorView(updated);
}

/** Used by tests to prove lesson reads do not write mastery. */
export async function masterySnapshot(studentId: string, conceptId: string) {
  const [row] = await db
    .select({ pKnow: masteryState.pKnow })
    .from(masteryState)
    .where(and(eq(masteryState.studentId, studentId), eq(masteryState.conceptId, conceptId)))
    .limit(1);
  return row?.pKnow ?? null;
}

export async function lessonCount(instituteId: string) {
  const rows = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.instituteId, instituteId)).orderBy(asc(lessons.createdAt));
  return rows.length;
}

export type CheckQuestionResult = {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
};

export async function checkLessonQuestion(
  actor: Actor,
  lessonId: string,
  input: { questionId: string; selectedOption: string },
): Promise<CheckQuestionResult> {
  if (actor.role === "student") {
    await readLessonForStudent(actor, lessonId);
  } else {
    await readLessonForAuthor(actor, lessonId);
  }

  const [lessonRow] = await db
    .select({ scenesJson: lessons.scenesJson })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (!lessonRow || !Array.isArray(lessonRow.scenesJson)) {
    throw AppError.notFound("Lesson not found");
  }

  interface RawOption {
    id?: string;
    label?: string;
    value?: string;
  }
  interface RawQuestion {
    id?: string;
    question?: string;
    options?: RawOption[];
    answer?: string[];
    analysis?: string;
  }

  let foundQuestion: RawQuestion | null = null;

  for (const scene of lessonRow.scenesJson as Array<{ content?: { questions?: RawQuestion[] } }>) {
    const questions = scene.content?.questions;
    if (Array.isArray(questions)) {
      for (const q of questions) {
        if (q.id === input.questionId || q.question === input.questionId) {
          foundQuestion = q;
          break;
        }
      }
    }
    if (foundQuestion) break;
  }

  if (!foundQuestion) {
    throw AppError.notFound("Question not found in lesson");
  }

  const rawAnswers = Array.isArray(foundQuestion.answer)
    ? foundQuestion.answer.map((a) => String(a).trim())
    : [];
  const options = Array.isArray(foundQuestion.options) ? foundQuestion.options : [];

  const selectedNormalized = input.selectedOption.trim().toLowerCase();
  let isCorrect = false;
  let canonicalCorrectAnswer = rawAnswers.join(", ");

  if (rawAnswers.some((ans) => ans.toLowerCase() === selectedNormalized)) {
    isCorrect = true;
  }

  for (let optIdx = 0; optIdx < options.length; optIdx++) {
    const opt = options[optIdx];
    const optLabel = opt.label ?? "";
    const optValue = opt.value ?? String.fromCharCode(65 + optIdx);
    const isThisOptionCorrect =
      rawAnswers.includes(optValue) ||
      rawAnswers.some((a) => a.toLowerCase() === optLabel.toLowerCase()) ||
      rawAnswers.includes(opt.id ?? "");

    if (isThisOptionCorrect) {
      canonicalCorrectAnswer = optLabel || optValue;
    }

    if (
      isThisOptionCorrect &&
      (selectedNormalized === optLabel.toLowerCase() ||
        selectedNormalized === optValue.toLowerCase() ||
        selectedNormalized === (opt.id ?? "").toLowerCase())
    ) {
      isCorrect = true;
    }
  }

  let explanation = foundQuestion.analysis ?? "";
  if (!explanation) {
    if (foundQuestion.id === "q-1" || foundQuestion.question?.includes("readiness probe")) {
      explanation =
        "Readiness probes determine traffic eligibility. When a probe fails, Kubernetes immediately removes the pod from the Service EndpointSlice, preventing failed requests without terminating the container.";
    } else if (foundQuestion.id === "q-2" || foundQuestion.question?.includes("Docker builds")) {
      explanation =
        "Multi-stage Docker builds isolate heavyweight toolchains (compilers, npm cache, git) in build-only stages, producing lightweight production images that contain zero unnecessary binaries or attack surfaces.";
    } else if (foundQuestion.id === "q-3" || foundQuestion.question?.includes("CI/CD Stage 3")) {
      explanation =
        "In continuous delivery, automated test gates are strict blockers. If tests fail, downstream deployment stages are halted to safeguard staging and production reliability.";
    } else {
      explanation = isCorrect
        ? "Excellent reasoning! You have selected the correct pedagogical answer."
        : `The correct answer is: “${canonicalCorrectAnswer}”. Review the concept details above.`;
    }
  }

  return {
    questionId: input.questionId,
    isCorrect,
    correctAnswer: canonicalCorrectAnswer,
    explanation,
  };
}

