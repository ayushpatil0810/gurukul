import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batchMembers,
  batchTrainers,
  batches,
  concepts,
  consents,
  explainQa,
  explainSets,
  institutes,
  learningSessions,
  masteryState,
  moduleConcepts,
  modules,
  prerequisites,
  questions,
  routingDecisions,
  signals,
  tests,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { readStudentDashboard, readStudentDetail, readTrainerDashboard } from "@/lib/services/dashboard";

const instituteId = crypto.randomUUID();
const otherInstituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const adminId = crypto.randomUUID();
const otherAdminId = crypto.randomUUID();
const adaId = crypto.randomUUID();
const benId = crypto.randomUUID();
const secret = `REFERENCE_${instituteId}`;
const hiddenOutput = `HIDDEN_OUTPUT_${instituteId}`;

function person(id: string, role: Actor["role"], institute: string): Actor {
  return { id, name: role, email: `${id}@example.com`, role, instituteId: institute };
}

afterAll(async () => {
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, otherInstituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  await db.delete(institutes).where(eq(institutes.id, otherInstituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("mastery dashboards", () => {
  it("keeps each role inside the existing batch and institute rules", async () => {
    await db.insert(institutes).values([
      { id: instituteId, name: `Dash ${instituteId}` },
      { id: otherInstituteId, name: `Other dash ${otherInstituteId}` },
    ]);
    await db.insert(user).values([
      { id: trainerId, name: "Trainer", email: `${trainerId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: outsiderId, name: "Outsider", email: `${outsiderId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: adminId, name: "Admin", email: `${adminId}@example.com`, emailVerified: true, role: "admin", instituteId },
      { id: otherAdminId, name: "Other admin", email: `${otherAdminId}@example.com`, emailVerified: true, role: "admin", instituteId: otherInstituteId },
      { id: adaId, name: "Ada", email: `${adaId}@example.com`, emailVerified: true, role: "student", instituteId },
      { id: benId, name: "Ben", email: `${benId}@example.com`, emailVerified: true, role: "student", instituteId },
    ]);
    const [batch] = await db.insert(batches).values({ instituteId, name: `Alpha ${instituteId}` }).returning();
    const [empty] = await db.insert(batches).values({ instituteId, name: `Zulu ${instituteId}` }).returning();
    await db.insert(batchTrainers).values([
      { batchId: batch!.id, trainerId, instituteId },
      { batchId: empty!.id, trainerId, instituteId },
    ]);
    await db.insert(batchMembers).values([
      { batchId: batch!.id, studentId: adaId, instituteId },
      { batchId: batch!.id, studentId: benId, instituteId },
    ]);
    const [variables] = await db.insert(concepts).values({ instituteId, name: `Variables ${instituteId}` }).returning();
    const [functions] = await db.insert(concepts).values({ instituteId, name: `Functions ${instituteId}` }).returning();
    await db.insert(prerequisites).values({ conceptId: functions!.id, requiresId: variables!.id, instituteId });
    const [moduleRow] = await db
      .insert(modules)
      .values({ instituteId, name: `Module ${instituteId}`, goalConceptId: functions!.id, masteryThreshold: 0.8 })
      .returning();
    await db.insert(moduleConcepts).values([
      { moduleId: moduleRow!.id, conceptId: variables!.id, instituteId },
      { moduleId: moduleRow!.id, conceptId: functions!.id, instituteId },
    ]);
    await db.insert(masteryState).values([
      { studentId: adaId, conceptId: variables!.id, instituteId, pKnow: 0.9 },
      { studentId: benId, conceptId: functions!.id, instituteId, pKnow: 0.2 },
    ]);
    const [question] = await db
      .insert(questions)
      .values({
        instituteId,
        statement: "Dashboard question",
        difficulty: 1,
        languages: ["javascript"],
        starterCodeJson: { javascript: "" },
        status: "published",
        referenceSolution: secret,
      })
      .returning();
    await db.insert(tests).values({
      questionId: question!.id,
      instituteId,
      visibility: "hidden",
      input: `HIDDEN_INPUT_${instituteId}`,
      expectedOutput: hiddenOutput,
    });
    const [consent] = await db.insert(consents).values({ instituteId, studentId: adaId, policyVersion: "test" }).returning();
    const [session] = await db
      .insert(learningSessions)
      .values({ instituteId, studentId: adaId, questionId: question!.id, mode: "graded", consentId: consent!.id })
      .returning();
    const [attempt] = await db
      .insert(attempts)
      .values({
        instituteId,
        sessionId: session!.id,
        kind: "submit",
        language: "javascript",
        code: "function total(n) { return n; }",
        passRate: 1,
        resultJson: { passed: 1, total: 1, passRate: 1, tests: [{ message: hiddenOutput }] },
      })
      .returning();
    const [set] = await db
      .insert(explainSets)
      .values({
        instituteId,
        attemptId: attempt!.id,
        sessionId: session!.id,
        studentId: adaId,
        language: "javascript",
        codeSnapshot: "function total(n) { return n; }",
        status: "answered",
      })
      .returning();
    await db.insert(explainQa).values({
      instituteId,
      attemptId: attempt!.id,
      questionText: "Why is line 1 written that way?",
      type: "reasoning",
      codeRefs: [{ startLine: 1, endLine: 1, quote: "function total(n) {" }],
      answerText: "no idea",
      verdict: "no",
      reviewStatus: "none",
    });
    await db.insert(signals).values({
      instituteId,
      sessionId: session!.id,
      studentId: adaId,
      type: "large_paste",
      strength: "high",
      confidence: 0.8,
      tStart: 0,
      tEnd: 1,
      seqStart: 1,
      seqEnd: 1,
      metricsJson: { chars: 10 },
      explanation: "A paste was stored.",
      ruleVersion: "integrity-v1",
      dedupeKey: `dashboard-${instituteId}`,
      reviewStatus: "pending",
      supported: true,
    });

    const ada = person(adaId, "student", instituteId);
    const beforeRoutes = await db.select().from(routingDecisions).where(eq(routingDecisions.studentId, adaId));
    const own = await readStudentDashboard(ada);
    const afterRoutes = await db.select().from(routingDecisions).where(eq(routingDecisions.studentId, adaId));
    expect(afterRoutes).toHaveLength(beforeRoutes.length);
    expect(JSON.stringify(own)).not.toContain(secret);
    expect(JSON.stringify(own)).not.toContain(hiddenOutput);
    expect(JSON.stringify(own)).not.toContain("Ben");
    expect(own.concepts.find((concept) => concept.id === functions!.id)?.pKnow).toBeNull();
    expect(own.concepts.find((concept) => concept.id === variables!.id)?.pKnow).toBe(0.9);
    expect(own.attempts[0]?.passRate).toBe(1);
    expect(own.attempts[0]?.explanation).toContain("incorrect");
    expect(own.attempts[0]?.replayHref).toBeNull();
    expect(own.recommendation?.storedMastery).toBeNull();

    const ben = await readStudentDashboard(person(benId, "student", instituteId));
    expect(JSON.stringify(ben)).not.toContain("Dashboard question");
    expect(ben.concepts.find((concept) => concept.id === functions!.id)?.pKnow).toBe(0.2);

    await expect(readStudentDetail(person(benId, "student", instituteId), adaId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(readStudentDetail(person(otherAdminId, "admin", otherInstituteId), adaId)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(readTrainerDashboard(person(outsiderId, "trainer", instituteId), { batchId: batch!.id })).rejects.toMatchObject({
      statusCode: 403,
    });

    const trainer = await readTrainerDashboard(person(trainerId, "trainer", instituteId), { batchId: batch!.id });
    expect(trainer.students.map((student) => student.name).sort()).toEqual(["Ada", "Ben"]);
    const adaFunctions = trainer.cells.find((cell) => cell.studentId === adaId && cell.conceptId === functions!.id);
    const benVariables = trainer.cells.find((cell) => cell.studentId === benId && cell.conceptId === variables!.id);
    expect(adaFunctions).toMatchObject({ pKnow: null, band: "not_recorded" });
    expect(benVariables).toMatchObject({ pKnow: null, band: "not_recorded" });
    expect(trainer.cells.find((cell) => cell.studentId === adaId && cell.conceptId === variables!.id)?.pKnow).toBe(0.9);
    expect(trainer.attempts[0]?.replayHref).toBe(`/replay/${session!.id}`);
    expect(trainer.pendingReviews).toBe(1);
    expect(JSON.stringify(trainer)).not.toContain(secret);
    expect(JSON.stringify(trainer)).not.toContain(hiddenOutput);

    const emptyView = await readTrainerDashboard(person(trainerId, "trainer", instituteId), { batchId: empty!.id });
    expect(emptyView.students).toEqual([]);
    expect(emptyView.cells).toEqual([]);

    const admin = await readTrainerDashboard(person(adminId, "admin", instituteId), { batchId: batch!.id });
    expect(admin.students).toHaveLength(2);

    const [mastery] = await db
      .select()
      .from(masteryState)
      .where(eq(masteryState.studentId, adaId));
    expect(mastery?.pKnow).toBe(0.9);
    expect(set?.id).toBeTruthy();
  });
});
