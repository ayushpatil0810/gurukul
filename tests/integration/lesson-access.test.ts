import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { AICallFn } from "@openmaic/generation";
import { db } from "@/db";
import { batchTrainers, batches, concepts, institutes, lessons, masteryState, moduleConcepts, modules, questionConcepts, questions, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { readStudentDashboard } from "@/lib/services/dashboard";
import {
  createLesson,
  generateLessonContent,
  lessonCount,
  masterySnapshot,
  publishLesson,
  readLessonForAuthor,
  readLessonForStudent,
  saveRepairedLesson,
  saveSceneEdits,
} from "@/lib/services/lessons";
import { AppError } from "@/lib/errors";

const instituteId = crypto.randomUUID();
const otherInstituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const adminId = crypto.randomUUID();
const otherAdminId = crypto.randomUUID();
const studentId = crypto.randomUUID();

function person(id: string, role: Actor["role"], institute: string): Actor {
  return { id, name: role, email: `${id}@example.com`, role, instituteId: institute };
}

const outlineJson = JSON.stringify({
  languageDirective: "Teach in English.",
  courseTitle: "Functions intro",
  outlines: [
    {
      id: "slide-1",
      type: "slide",
      title: "What a function returns",
      description: "A function maps an input to an output.",
      keyPoints: ["Input goes in", "Output comes out"],
      order: 1,
    },
    {
      id: "quiz-1",
      type: "quiz",
      title: "Check",
      description: "One ungraded question.",
      keyPoints: ["Name the output"],
      order: 2,
      quizConfig: { questionCount: 1, difficulty: "easy", questionTypes: ["single"] },
    },
  ],
});

const slideJson = JSON.stringify({
  background: { type: "solid", color: "#ffffff" },
  elements: [
    {
      id: "text_001",
      type: "text",
      left: 60,
      top: 80,
      width: 880,
      height: 80,
      content: "<p>A function returns an output.</p>",
      defaultFontName: "Microsoft YaHei",
      defaultColor: "#333333",
    },
  ],
});

const quizJson = JSON.stringify([
  {
    id: "q1",
    type: "single",
    question: "What does a function return?",
    options: [
      { label: "An output", value: "A" },
      { label: "A file", value: "B" },
    ],
    answer: ["A"],
    analysis: "It returns an output.",
    points: 10,
  },
]);

const model: AICallFn = async (systemPrompt) => {
  if (systemPrompt.includes("Scene Outline")) return outlineJson;
  if (systemPrompt.includes("Slide Content")) return slideJson;
  if (systemPrompt.includes("Quiz Content")) return quizJson;
  return "[]";
};

const broken: AICallFn = async () => "this is not a lesson";
const down: AICallFn = async () => {
  throw new Error("provider down");
};

afterAll(async () => {
  await db.delete(lessons).where(eq(lessons.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, otherInstituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  await db.delete(institutes).where(eq(institutes.id, otherInstituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("lesson studio", () => {
  it("keeps drafts private, publishes only valid lessons, and leaves mastery unchanged", async () => {
    await db.insert(institutes).values([
      { id: instituteId, name: `Lessons ${instituteId}` },
      { id: otherInstituteId, name: `Other lessons ${otherInstituteId}` },
    ]);
    await db.insert(user).values([
      { id: trainerId, name: "Trainer", email: `${trainerId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: outsiderId, name: "Outsider", email: `${outsiderId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: adminId, name: "Admin", email: `${adminId}@example.com`, emailVerified: true, role: "admin", instituteId },
      { id: otherAdminId, name: "Other admin", email: `${otherAdminId}@example.com`, emailVerified: true, role: "admin", instituteId: otherInstituteId },
      { id: studentId, name: "Ada", email: `${studentId}@example.com`, emailVerified: true, role: "student", instituteId },
    ]);
    const [batch] = await db.insert(batches).values({ instituteId, name: `Batch ${instituteId}` }).returning();
    await db.insert(batchTrainers).values({ batchId: batch!.id, trainerId, instituteId });
    const [concept] = await db.insert(concepts).values({ instituteId, name: `Functions ${instituteId}` }).returning();
    const [moduleRow] = await db
      .insert(modules)
      .values({ instituteId, name: `Module ${instituteId}`, goalConceptId: concept!.id })
      .returning();
    await db.insert(moduleConcepts).values({ moduleId: moduleRow!.id, conceptId: concept!.id, instituteId });
    const [question] = await db
      .insert(questions)
      .values({
        instituteId,
        statement: "Return one.",
        difficulty: 1,
        languages: ["javascript"],
        starterCodeJson: { javascript: "" },
        status: "published",
      })
      .returning();
    await db.insert(questionConcepts).values({ questionId: question!.id, conceptId: concept!.id, instituteId });
    await db.insert(masteryState).values({ studentId, conceptId: concept!.id, instituteId, pKnow: 0.42, confidence: 0 });

    const trainer = person(trainerId, "trainer", instituteId);
    const student = person(studentId, "student", instituteId);
    const outsider = person(outsiderId, "trainer", instituteId);
    const otherAdmin = person(otherAdminId, "admin", otherInstituteId);
    const brief = {
      moduleId: moduleRow!.id,
      conceptId: concept!.id,
      topic: "Functions",
      objectives: "Explain what a function returns.",
      learnerLevel: "beginner",
      durationMinutes: 15,
    };

    await expect(createLesson(student, brief)).rejects.toMatchObject({ statusCode: 403 });
    await expect(createLesson(student, brief, model)).rejects.toMatchObject({ statusCode: 403 });
    await expect(createLesson(trainer, { ...brief, conceptId: crypto.randomUUID() }, model)).rejects.toMatchObject({ statusCode: 404 });
    await expect(createLesson(outsider, brief, model)).rejects.toMatchObject({ statusCode: 403 });
    await expect(createLesson(trainer, brief, broken)).rejects.toBeInstanceOf(AppError);
    await expect(createLesson(trainer, brief, down)).rejects.toBeInstanceOf(AppError);
    expect(await lessonCount(instituteId)).toBe(0);
    expect(await masterySnapshot(studentId, concept!.id)).toBe(0.42);

    const created = await createLesson(trainer, brief, model);
    expect(created.status).toBe("draft");
    expect(created.outlines.map((outline) => outline.type)).toEqual(["slide", "quiz"]);
    expect(created.scenes).toEqual([]);
    await expect(readLessonForStudent(student, created.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(readLessonForAuthor(otherAdmin, created.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(readLessonForAuthor(outsider, created.id)).rejects.toMatchObject({ statusCode: 403 });
    const beforeContent = await readStudentDashboard(student);
    expect(beforeContent.recommendation?.lesson).toBeNull();

    await expect(generateLessonContent(trainer, created.id, created.version, broken)).rejects.toBeInstanceOf(AppError);
    const stillDraft = await readLessonForAuthor(trainer, created.id);
    expect(stillDraft.scenes).toEqual([]);
    expect(stillDraft.status).toBe("draft");
    expect(await masterySnapshot(studentId, concept!.id)).toBe(0.42);

    const generated = await generateLessonContent(trainer, created.id, created.version, model);
    expect(generated.scenes.map((scene) => scene.type)).toEqual(["slide", "quiz"]);
    expect(generated.scenes[1]?.questions[0]?.answer).toBe("A");
    expect(generated.status).toBe("draft");
    await expect(publishLesson(outsider, generated.id, generated.version)).rejects.toMatchObject({ statusCode: 403 });

    const published = await publishLesson(trainer, generated.id, generated.version);
    expect(published.status).toBe("published");
    const visible = await readLessonForStudent(student, published.id);
    expect(visible.scenes[1]?.questions[0]?.answer).toBeNull();
    expect(visible.scenes[0]?.paragraphs.join(" ")).toContain("output");
    const dashboard = await readStudentDashboard(student);
    expect(dashboard.recommendation?.lesson).toEqual({ id: published.id, title: published.title });
    expect(dashboard.recommendation?.storedMastery).toBe(0.42);
    expect(await masterySnapshot(studentId, concept!.id)).toBe(0.42);

    const [otherConcept] = await db.insert(concepts).values({ instituteId, name: `Other ${instituteId}` }).returning();
    const [offPath] = await db
      .insert(lessons)
      .values({
        instituteId,
        moduleId: moduleRow!.id,
        conceptId: otherConcept!.id,
        createdBy: trainerId,
        title: "Off path",
        topic: "Off path",
        objectives: "A different concept.",
        learnerLevel: "beginner",
        durationMinutes: 15,
        status: "published",
        languageDirective: "explanation=en;code=typescript",
        outlineJson: [],
        scenesJson: [],
        publishedAt: new Date(),
      })
      .returning();
    await expect(readLessonForStudent(student, offPath!.id)).rejects.toMatchObject({ statusCode: 404 });

    const [stored] = await db.select().from(lessons).where(eq(lessons.id, published.id));
    const brokenScenes = structuredClone(stored!.scenesJson) as {
      id: string;
      content: { canvas: { elements: { content?: string }[] } };
    }[];
    brokenScenes[0]!.content.canvas.elements[0]!.content += " 位置";
    await db.update(lessons).set({ scenesJson: brokenScenes }).where(eq(lessons.id, published.id));
    const flagged = await readLessonForAuthor(trainer, published.id);
    expect(flagged.issues.some((issue) => issue.severity === "error" && issue.sceneId === flagged.scenes[0]?.id)).toBe(true);
    await expect(publishLesson(trainer, published.id, flagged.version)).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      saveRepairedLesson(trainer, published.id, flagged.version, [{ sceneId: flagged.scenes[0]!.id, phrases: [{ from: "missing label", to: "English" }] }], "typescript"),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      saveSceneEdits(trainer, published.id, flagged.version, [
        {
          id: flagged.scenes[0]!.id,
          title: flagged.scenes[0]!.title,
          body: "位置 stays in the published lesson",
          questions: [],
        },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(generateLessonContent(trainer, published.id, flagged.version, model, flagged.scenes[1]!.outlineId)).rejects.toMatchObject({ statusCode: 400 });
    const preserved = await readLessonForAuthor(trainer, published.id);
    expect(preserved.version).toBe(flagged.version);
    expect(preserved.scenes[0]?.paragraphs.join(" ")).toContain("位置");
    expect(preserved.scenes[1]?.questions[0]?.prompt).toBe("What does a function return?");

    const repaired = await saveRepairedLesson(
      trainer,
      published.id,
      preserved.version,
      [{ sceneId: preserved.scenes[0]!.id, phrases: [{ from: "位置", to: "Where it goes" }] }],
      "typescript",
    );
    expect(repaired.status).toBe("published");
    expect(repaired.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(repaired.scenes[0]?.paragraphs.join(" ")).toContain("Where it goes");
    expect(repaired.scenes[0]?.paragraphs.join(" ")).not.toContain("位置");
    expect(repaired.scenes[1]?.questions[0]?.prompt).toBe("What does a function return?");
    const studentView = await readLessonForStudent(student, repaired.id);
    expect(studentView.scenes[1]?.questions[0]?.answer).toBeNull();
    expect(await masterySnapshot(studentId, concept!.id)).toBe(0.42);
  });
});
