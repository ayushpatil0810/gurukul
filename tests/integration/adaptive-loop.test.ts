import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batchMembers,
  batchTrainers,
  batches,
  classroomEvents,
  concepts,
  institutes,
  learningSessions,
  lessons,
  masteryState,
  masteryUpdates,
  moduleConcepts,
  modules,
  prerequisites,
  questionConcepts,
  questions,
  tests,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { addPrerequisite, createConcept, createModule } from "@/lib/services/concepts";
import { createQuestion } from "@/lib/services/questions";
import { readLessonForStudent } from "@/lib/services/lessons";
import { acceptConsent, startSession, submitSession } from "@/lib/services/assessment";
import { getAdaptiveRecommendation } from "@/lib/services/adaptive-loop";
import { readStudentDashboard } from "@/lib/services/dashboard";
import { recordClassroomTelemetry } from "@/lib/services/classroom-telemetry";
import { getClassroomAnalytics } from "@/lib/services/classroom-analytics";
import { sanitizeAndValidateClassroomPayload } from "@/lib/validations/classroom-telemetry";
import { AppError } from "@/lib/errors";
import { RunQueue } from "@/sandbox/queue";
import type { SandboxRunner } from "@/sandbox/types";

const instituteId = crypto.randomUUID();
const otherInstituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const outsiderTrainerId = crypto.randomUUID();
const adaId = crypto.randomUUID();
const benId = crypto.randomUUID();
const outsiderStudentId = crypto.randomUUID();

const trainer: Actor = {
  id: trainerId,
  name: "Trainer",
  email: `trainer_${trainerId}@example.com`,
  role: "trainer",
  instituteId,
};

const outsiderTrainer: Actor = {
  id: outsiderTrainerId,
  name: "Outsider Trainer",
  email: `outsider_${outsiderTrainerId}@example.com`,
  role: "trainer",
  instituteId: otherInstituteId,
};

function student(id: string, name: string, inst = instituteId): Actor {
  return { id, name, email: `${id}@example.com`, role: "student", instituteId: inst };
}

const ada = student(adaId, "Ada");
const ben = student(benId, "Ben");
const outsiderStudent = student(outsiderStudentId, "Outsider", otherInstituteId);

const secretHiddenPayload = `SECRET_TEST_${instituteId}`;

const mockRunner: SandboxRunner = {
  async run(_language, _code, stdin) {
    return {
      outcome: "ok",
      stdout: stdin.includes("HIDDEN") ? `${secretHiddenPayload}\n` : "visible-ok\n",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 5,
      message: "Success",
    };
  },
};

const deps = {
  runner: mockRunner,
  queue: new RunQueue({ concurrency: 2, perStudentPerMinute: 30 }),
};

let variablesConceptId: string;
let functionsConceptId: string;
let classesConceptId: string;
let testModuleId: string;
let variablesQuestionId: string;
let functionsQuestionId: string;
let variablesLessonId: string;
let functionsLessonId: string;

beforeAll(async () => {
  // Create institutes
  await db.insert(institutes).values([
    { id: instituteId, name: `Adaptive Test Institute ${instituteId}` },
    { id: otherInstituteId, name: `Other Test Institute ${otherInstituteId}` },
  ]);

  // Create users
  await db.insert(user).values([
    { id: trainerId, name: "Trainer", email: trainer.email, emailVerified: true, role: "trainer", instituteId },
    { id: outsiderTrainerId, name: "Outsider Trainer", email: outsiderTrainer.email, emailVerified: true, role: "trainer", instituteId: otherInstituteId },
    { id: adaId, name: "Ada", email: ada.email, emailVerified: true, role: "student", instituteId },
    { id: benId, name: "Ben", email: ben.email, emailVerified: true, role: "student", instituteId },
    { id: outsiderStudentId, name: "Outsider", email: outsiderStudent.email, emailVerified: true, role: "student", instituteId: otherInstituteId },
  ]);

  // Create batch and assign trainer and students
  const [batch] = await db.insert(batches).values({ instituteId, name: `Batch_${instituteId}` }).returning();
  await db.insert(batchTrainers).values({ batchId: batch!.id, trainerId, instituteId });
  await db.insert(batchMembers).values([
    { batchId: batch!.id, studentId: adaId, instituteId },
    { batchId: batch!.id, studentId: benId, instituteId },
  ]);

  // Create concepts: Variables -> Functions -> Classes
  const c1 = await createConcept(trainer, { name: `Variables_${instituteId}` });
  const c2 = await createConcept(trainer, { name: `Functions_${instituteId}` });
  const c3 = await createConcept(trainer, { name: `Classes_${instituteId}` });
  variablesConceptId = c1.id;
  functionsConceptId = c2.id;
  classesConceptId = c3.id;

  // Prerequisites: Functions requires Variables, Classes requires Functions
  await addPrerequisite(trainer, functionsConceptId, variablesConceptId);
  await addPrerequisite(trainer, classesConceptId, functionsConceptId);

  // Module with goal Classes and threshold 0.80
  const mod = await createModule(trainer, {
    name: `DevOps Mastery Module ${instituteId}`,
    goalConceptId: classesConceptId,
    masteryThreshold: 0.8,
    conceptIds: [variablesConceptId, functionsConceptId, classesConceptId],
  });
  testModuleId = mod.id;

  // Published Questions
  const qPayload = {
    languages: ["javascript" as const],
    starterCode: { javascript: "// write code here" },
    status: "published" as const,
    tests: [
      { visibility: "visible" as const, input: "1\n", expectedOutput: "visible-ok\n" },
      { visibility: "hidden" as const, input: `HIDDEN ${instituteId}\n`, expectedOutput: `${secretHiddenPayload}\n` },
    ],
  };

  const q1 = await createQuestion(trainer, {
    statement: `Solve Variables Problem ${instituteId}`,
    difficulty: 1,
    conceptIds: [variablesConceptId],
    ...qPayload,
  });
  variablesQuestionId = q1.id;

  const q2 = await createQuestion(trainer, {
    statement: `Solve Functions Problem ${instituteId}`,
    difficulty: 2,
    conceptIds: [functionsConceptId],
    ...qPayload,
  });
  functionsQuestionId = q2.id;

  // Published Lessons
  const [l1] = await db
    .insert(lessons)
    .values({
      instituteId,
      moduleId: testModuleId,
      conceptId: variablesConceptId,
      createdBy: trainerId,
      title: `Intro to Variables ${instituteId}`,
      topic: "Variables",
      objectives: "Variables store values",
      learnerLevel: "beginner",
      durationMinutes: 15,
      status: "published",
      outlineJson: [
        {
          id: "scene-1",
          type: "slide",
          title: "Intro to Variables",
          description: "Variables store values",
          keyPoints: ["let", "const"],
          order: 1,
        },
      ],
      scenesJson: [
        {
          id: "scene-1",
          outlineId: "scene-1",
          type: "slide",
          order: 1,
          title: "Intro to Variables",
          content: { canvas: { elements: [{ type: "text", content: "<p>Variables</p>" }] } },
        },
      ],
      publishedAt: new Date(),
    })
    .returning();
  variablesLessonId = l1!.id;

  const [l2] = await db
    .insert(lessons)
    .values({
      instituteId,
      moduleId: testModuleId,
      conceptId: functionsConceptId,
      createdBy: trainerId,
      title: `Mastering Functions ${instituteId}`,
      topic: "Functions",
      objectives: "Functions map inputs to outputs",
      learnerLevel: "beginner",
      durationMinutes: 20,
      status: "published",
      outlineJson: [
        {
          id: "scene-1",
          type: "slide",
          title: "Intro to Functions",
          description: "Functions map inputs to outputs",
          keyPoints: ["params", "return"],
          order: 1,
        },
      ],
      scenesJson: [
        {
          id: "scene-1",
          outlineId: "scene-1",
          type: "slide",
          order: 1,
          title: "Intro to Functions",
          content: { canvas: { elements: [{ type: "text", content: "<p>Functions</p>" }] } },
        },
      ],
      publishedAt: new Date(),
    })
    .returning();
  functionsLessonId = l2!.id;
});

afterAll(async () => {
  try {
    await db.delete(classroomEvents).where(eq(classroomEvents.instituteId, instituteId));
    await db.delete(masteryUpdates).where(eq(masteryUpdates.instituteId, instituteId));
    await db.delete(masteryState).where(eq(masteryState.instituteId, instituteId));
    await db.delete(attempts).where(eq(attempts.instituteId, instituteId));
    await db.delete(learningSessions).where(eq(learningSessions.instituteId, instituteId));
    await db.delete(lessons).where(eq(lessons.instituteId, instituteId));
    await db.delete(tests).where(eq(tests.instituteId, instituteId));
    await db.delete(questionConcepts).where(eq(questionConcepts.instituteId, instituteId));
    await db.delete(questions).where(eq(questions.instituteId, instituteId));
    await db.delete(prerequisites).where(eq(prerequisites.instituteId, instituteId));
    await db.delete(moduleConcepts).where(eq(moduleConcepts.instituteId, instituteId));
    await db.delete(modules).where(eq(modules.instituteId, instituteId));
    await db.delete(concepts).where(eq(concepts.instituteId, instituteId));
    await db.delete(batchMembers).where(eq(batchMembers.instituteId, instituteId));
    await db.delete(batchTrainers).where(eq(batchTrainers.instituteId, instituteId));
    await db.delete(batches).where(eq(batches.instituteId, instituteId));
    await db.delete(user).where(eq(user.instituteId, instituteId));
    await db.delete(user).where(eq(user.instituteId, otherInstituteId));
    await db.delete(institutes).where(eq(institutes.id, instituteId));
    await db.delete(institutes).where(eq(institutes.id, otherInstituteId));
  } catch {
    // best-effort test cleanup
  }
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("Phase 5.3: Adaptive Learning Loop", () => {
  it("A. Missing mastery representation and baseline recommendation", async () => {
    // Ada has no recorded mastery rows in DB
    const [adaMastery] = await db
      .select()
      .from(masteryState)
      .where(and(eq(masteryState.studentId, adaId), eq(masteryState.conceptId, variablesConceptId)));
    expect(adaMastery).toBeUndefined();

    // Call getAdaptiveRecommendation for Ada
    const rec = await getAdaptiveRecommendation(ada, { studentId: adaId, moduleId: testModuleId });

    // Stored mastery must be NULL (not 0, not 0.20 BKT prior)
    expect(rec.mastery).toBeNull();
    expect(rec.concept?.id).toBe(variablesConceptId);
    expect(rec.recommendation).not.toBeNull();
    // Since variables has a published lesson and Ada has no recorded mastery, lesson is recommended
    expect(rec.recommendation?.activityType).toBe("lesson");
    expect(rec.recommendation?.title).toBe(`Interactive Lesson: Intro to Variables ${instituteId}`);
    expect(rec.recommendation?.activityId).toBe(variablesLessonId);
    expect(rec.recommendation?.href).toBe(`/learn/${variablesLessonId}?from=recommendation`);
    expect(rec.reason).toContain("has not been recorded");
    expect(rec.evidenceSummary.totalAttempts).toBe(0);

    // Verify DB still has NO mastery rows for Ada (generating recommendation does not mutate mastery)
    const [adaMasteryAfter] = await db
      .select()
      .from(masteryState)
      .where(and(eq(masteryState.studentId, adaId), eq(masteryState.conceptId, variablesConceptId)));
    expect(adaMasteryAfter).toBeUndefined();
  });

  it("B. Prerequisite readiness blocking and remediation recommendation", async () => {
    // Ben has recorded mastery for Functions = 0.35, but Variables has NO recorded mastery (or below 0.80)
    await db.insert(masteryState).values({
      studentId: benId,
      conceptId: functionsConceptId,
      instituteId,
      pKnow: 0.35,
      confidence: 0.5,
    });

    const rec = await getAdaptiveRecommendation(ben, { studentId: benId, moduleId: testModuleId });

    // Since Variables is a prerequisite for Functions and is below threshold (0.80),
    // the system should select Variables as the ready concept to work on.
    expect(rec.concept?.id).toBe(variablesConceptId);
    expect(rec.recommendation).not.toBeNull();
    expect(rec.prerequisites.length).toBe(0); // Variables has no prerequisites itself
  });

  it("C. Authoritative Assessment-to-Mastery Integration and Recommendation Shift", async () => {
    // Accept assessment consent for Ada
    await acceptConsent(ada);

    // Ada starts and submits a graded assessment session on Variables
    const session = await startSession(ada, { questionId: variablesQuestionId, mode: "graded" });
    expect(session.recording).toBe(true);

    const submitResult = await submitSession(
      ada,
      session.id,
      { language: "javascript", code: "console.log('solution');" },
      deps,
    );

    expect(submitResult.passed).toBe(1); // hidden passed
    expect(submitResult.mastery.length).toBeGreaterThan(0);
    const updatedMastery = submitResult.mastery[0]!;
    expect(updatedMastery.conceptId).toBe(variablesConceptId);
    expect(updatedMastery.before).toBeCloseTo(0.20, 2); // default BKT p_init prior before update
    expect(updatedMastery.after).toBeGreaterThan(0.20); // BKT updated after success

    // Verify mastery row now exists in DB
    const [persistedMastery] = await db
      .select()
      .from(masteryState)
      .where(and(eq(masteryState.studentId, adaId), eq(masteryState.conceptId, variablesConceptId)));
    expect(persistedMastery).toBeDefined();
    expect(persistedMastery!.pKnow).toBeCloseTo(updatedMastery.after, 6);

    // Verify audit log exists in masteryUpdates
    const auditRows = await db
      .select()
      .from(masteryUpdates)
      .where(and(eq(masteryUpdates.studentId, adaId), eq(masteryUpdates.conceptId, variablesConceptId)));
    expect(auditRows.length).toBe(1);
    expect(auditRows[0]!.causeType).toBe("attempt");

    // Boost Ada's Variables mastery to 0.90 (above threshold 0.80) to test prerequisite unlocking
    await db
      .update(masteryState)
      .set({ pKnow: 0.90 })
      .where(and(eq(masteryState.studentId, adaId), eq(masteryState.conceptId, variablesConceptId)));

    // Now request recommendation again: Variables is mastered (0.90 >= 0.80), so Functions should be selected!
    const nextRec = await getAdaptiveRecommendation(ada, { studentId: adaId, moduleId: testModuleId });
    expect(nextRec.concept?.id).toBe(functionsConceptId);
    expect(nextRec.mastery).toBeNull(); // Functions mastery still unrecorded
    // Functions has prerequisite Variables which is MET
    const varPrereq = nextRec.prerequisites.find((p) => p.id === variablesConceptId);
    expect(varPrereq).toBeDefined();
    expect(varPrereq!.ready).toBe(true);
    expect(varPrereq!.storedMastery).toBeCloseTo(0.90, 2);
  });

  it("D. Idempotency: Duplicate submission does not re-apply mastery updates", async () => {
    // Start session for Ben on Variables
    await acceptConsent(ben);
    const session = await startSession(ben, { questionId: variablesQuestionId, mode: "graded" });

    // First submission
    const firstSubmit = await submitSession(
      ben,
      session.id,
      { language: "javascript", code: "console.log('solution');" },
      deps,
    );
    expect(firstSubmit.passed).toBe(1);
    expect(firstSubmit.mastery.length).toBe(1);

    const benMastery1 = await db
      .select()
      .from(masteryState)
      .where(and(eq(masteryState.studentId, benId), eq(masteryState.conceptId, variablesConceptId)));
    expect(benMastery1.length).toBe(1);
    const pKnow1 = benMastery1[0]!.pKnow;

    const auditCount1 = await db
      .select()
      .from(masteryUpdates)
      .where(and(eq(masteryUpdates.studentId, benId), eq(masteryUpdates.conceptId, variablesConceptId)));
    const auditLength1 = auditCount1.length;

    // Second submission with same session.id
    const secondSubmit = await submitSession(
      ben,
      session.id,
      { language: "javascript", code: "console.log('solution');" },
      deps,
    );
    expect(secondSubmit.passed).toBe(1);

    // Verify mastery did NOT update a second time
    const benMastery2 = await db
      .select()
      .from(masteryState)
      .where(and(eq(masteryState.studentId, benId), eq(masteryState.conceptId, variablesConceptId)));
    expect(benMastery2[0]!.pKnow).toBe(pKnow1);

    // Verify no new masteryUpdates rows inserted
    const auditCount2 = await db
      .select()
      .from(masteryUpdates)
      .where(and(eq(masteryUpdates.studentId, benId), eq(masteryUpdates.conceptId, variablesConceptId)));
    expect(auditCount2.length).toBe(auditLength1);
  });

  it("E. Invariance: Formative interactions, lesson views, and telemetry do NOT alter mastery", async () => {
    const [adaMasteryBefore] = await db
      .select()
      .from(masteryState)
      .where(and(eq(masteryState.studentId, adaId), eq(masteryState.conceptId, variablesConceptId)));
    const initialAdaPKnow = adaMasteryBefore!.pKnow;

    // 1. Reading/viewing the recommended lesson
    await readLessonForStudent(ada, functionsLessonId);

    // 2. Telemetry ingestion: recommendation_view
    const recViewPayload = sanitizeAndValidateClassroomPayload("recommendation_view", {
      conceptId: functionsConceptId,
      activityType: "lesson",
      targetId: functionsLessonId,
    });
    await recordClassroomTelemetry(ada, functionsLessonId, [
      { seq: 1, t: 100, type: "recommendation_view", payload: recViewPayload },
    ]);

    // 3. Telemetry ingestion: recommendation_click
    const recClickPayload = sanitizeAndValidateClassroomPayload("recommendation_click", {
      conceptId: functionsConceptId,
      activityType: "lesson",
      targetId: functionsLessonId,
      action: "open_recommendation",
    });
    await recordClassroomTelemetry(ada, functionsLessonId, [
      { seq: 2, t: 200, type: "recommendation_click", payload: recClickPayload },
    ]);

    // 4. Formative interactions (docker_command, diagram_node_click, mentor_query_sent)
    await recordClassroomTelemetry(ada, functionsLessonId, [
      { seq: 3, t: 300, type: "diagram_node_click", payload: { nodeId: "node-1", label: "Functions Diagram" } },
      { seq: 4, t: 400, type: "docker_command", payload: { command: "docker ps", exitCode: 0, durationMs: 12 } },
      { seq: 5, t: 500, type: "mentor_query_sent", payload: { questionLength: 20, sceneIndex: 0 } },
    ]);

    // Verify Ada's mastery is completely unchanged
    const [adaMasteryAfter] = await db
      .select()
      .from(masteryState)
      .where(and(eq(masteryState.studentId, adaId), eq(masteryState.conceptId, variablesConceptId)));
    expect(adaMasteryAfter!.pKnow).toBe(initialAdaPKnow);
  });

  it("F. Analytics aggregates recommendation events correctly", async () => {
    const analytics = await getClassroomAnalytics(trainer, { lessonId: functionsLessonId });
    expect(analytics).toBeDefined();
    expect(analytics.recommendations).toBeDefined();
    expect(analytics.recommendations.viewsCount).toBeGreaterThanOrEqual(1);
    expect(analytics.recommendations.clicksCount).toBeGreaterThanOrEqual(1);
  });

  it("G. Authorization boundaries and privacy protections", async () => {
    // Student Ada cannot request recommendation for Student Ben
    await expect(
      getAdaptiveRecommendation(ada, { studentId: benId, moduleId: testModuleId }),
    ).rejects.toThrow(AppError);

    // Trainer from another institute cannot request recommendation for Ada
    await expect(
      getAdaptiveRecommendation(outsiderTrainer, { studentId: adaId, moduleId: testModuleId }),
    ).rejects.toThrow(AppError);

    // Trainer from same institute CAN request recommendation for Ada
    const trainerView = await getAdaptiveRecommendation(trainer, { studentId: adaId, moduleId: testModuleId });
    expect(trainerView.concept?.id).toBe(functionsConceptId);

    // Ensure hidden test payload and answers are NEVER leaked in recommendation output
    const serialized = JSON.stringify(trainerView);
    expect(serialized).not.toContain(secretHiddenPayload);
    expect(serialized).not.toContain("HIDDEN");
  });

  it("H. Student Dashboard exposes enriched recommendation and safe empty state", async () => {
    const dashboard = await readStudentDashboard(ada, testModuleId);
    expect(dashboard).toBeDefined();
    expect(dashboard.recommendation).toBeDefined();

    const rec = dashboard.recommendation!;
    expect(rec.conceptId).toBe(functionsConceptId);
    expect(rec.reason).toBeDefined();
    expect(rec.badgeLabel).toBeDefined();
    expect(rec.actionLabel).toBeDefined();
    expect(rec.href).toBeDefined();
    expect(rec.prerequisites).toBeDefined();
    expect(rec.evidenceSummary).toBeDefined();
  });

  it("I. Recommendation API endpoint security", async () => {
    const { GET } = await import("@/app/api/learning/recommendation/route");
    const req = new Request(`http://localhost:3000/api/learning/recommendation?moduleId=${testModuleId}`);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
