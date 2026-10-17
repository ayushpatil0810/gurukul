import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  institutes,
  batches,
  batchMembers,
  concepts,
  modules,
  moduleConcepts,
  masteryState,
  questions,
  questionConcepts,
  learningSessions,
  consents,
  attempts,
  prerequisites,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { readStudentDashboardFullView } from "@/lib/services/dashboard";

const instituteId = crypto.randomUUID();
const studentId = crypto.randomUUID();
const peerStudentId = crypto.randomUUID();
const conceptId1 = crypto.randomUUID();
const conceptId2 = crypto.randomUUID();
const moduleId = crypto.randomUUID();
const batchId = crypto.randomUUID();
const questionId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const attemptId = crypto.randomUUID();

afterAll(async () => {
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("Student Dashboard Full View Service", () => {
  it("aggregates course completion, assignments, leaderboards, and roadmap correctly", async () => {
    // 1. Setup institute & batch
    await db.insert(institutes).values({ id: instituteId, name: `Inst-${instituteId}` });
    await db.insert(batches).values({ id: batchId, instituteId, name: "Alpha Batch" });

    // 2. Setup students
    await db.insert(user).values([
      { id: studentId, name: "Test Student", email: `${studentId}@test.com`, role: "student", instituteId },
      { id: peerStudentId, name: "Peer Student", email: `${peerStudentId}@test.com`, role: "student", instituteId },
    ]);

    await db.insert(batchMembers).values([
      { batchId, studentId, instituteId },
      { batchId, studentId: peerStudentId, instituteId },
    ]);

    // 3. Setup concepts and module
    await db.insert(concepts).values([
      { id: conceptId1, instituteId, name: "Variables & Types", description: "Basics of variables" },
      { id: conceptId2, instituteId, name: "Functions & Scope", description: "Functions" },
    ]);

    await db.insert(modules).values({
      id: moduleId,
      instituteId,
      name: "TypeScript Foundations",
      goalConceptId: conceptId2,
      masteryThreshold: 0.8,
    });

    await db.insert(moduleConcepts).values([
      { moduleId, conceptId: conceptId1, instituteId },
      { moduleId, conceptId: conceptId2, instituteId },
    ]);

    await db.insert(prerequisites).values({
      conceptId: conceptId2,
      requiresId: conceptId1,
      instituteId,
    });

    // 4. Setup student mastery (Student has mastered concept 1, peer hasn't)
    await db.insert(masteryState).values([
      { studentId, conceptId: conceptId1, instituteId, pKnow: 0.9, confidence: 0.85 },
      { studentId: peerStudentId, conceptId: conceptId1, instituteId, pKnow: 0.4, confidence: 0.5 },
    ]);

    // 5. Setup questions and graded submissions
    await db.insert(questions).values({
      id: questionId,
      instituteId,
      statement: "Write a function that doubles an integer.",
      difficulty: 1,
      languages: ["javascript"],
      starterCodeJson: { javascript: "// code" },
      status: "published",
    });

    await db.insert(questionConcepts).values({
      questionId,
      conceptId: conceptId1,
      instituteId,
    });

    const consentId = crypto.randomUUID();
    await db.insert(consents).values({
      id: consentId,
      instituteId,
      studentId,
      policyVersion: "1.0",
    });

    await db.insert(learningSessions).values({
      id: sessionId,
      instituteId,
      studentId,
      questionId,
      mode: "graded",
      consentId,
    });

    await db.insert(attempts).values({
      id: attemptId,
      instituteId,
      sessionId,
      kind: "submit",
      language: "javascript",
      code: "console.log(2 * x);",
      passRate: 1.0,
      resultJson: { passed: 2, total: 2 },
    });

    const actor: Actor = {
      id: studentId,
      name: "Test Student",
      email: `${studentId}@test.com`,
      role: "student",
      instituteId,
    };

    // 6. Execute full view retrieval
    const fullView = await readStudentDashboardFullView(actor, moduleId);

    // 7. Verify all requested properties exist and match expectations
    expect(fullView.student.name).toBe("Test Student");
    expect(fullView.batch?.name).toBe("Alpha Batch");
    expect(fullView.module?.name).toBe("TypeScript Foundations");

    // Overview metrics
    expect(fullView.overview.totalConcepts).toBe(2);
    expect(fullView.overview.masteredConcepts).toBe(1);
    expect(fullView.overview.courseCompletionRate).toBe(0.5); // 1 out of 2 concepts
    expect(fullView.overview.standingLabel).toBe("1/2 Mastered");

    // Assignment completion tracking
    expect(fullView.assignments.totalCount).toBeGreaterThanOrEqual(1);
    expect(fullView.assignments.completedCount).toBeGreaterThanOrEqual(1);

    // Leaderboards
    expect(fullView.leaderboard.course.length).toBe(2);
    expect(fullView.leaderboard.course[0]?.studentId).toBe(studentId); // Ranked #1 due to higher mastery
    expect(fullView.leaderboard.course[0]?.rank).toBe(1);
    expect(fullView.leaderboard.currentStudentRanks.courseRank).toBe(1);

    // Concept rows
    expect(fullView.concepts.length).toBe(2);
    const varConcept = fullView.concepts.find((c) => c.id === conceptId1);
    expect(varConcept?.band).toBe("solid");
    expect(varConcept?.pKnow).toBe(0.9);

    // Roadmap chart data
    expect(fullView.roadmapChart.length).toBe(2);
    expect(fullView.roadmapChart[0]?.mastery).toBe(90);

    // Activity feed
    expect(fullView.activityFeed.length).toBeGreaterThanOrEqual(1);
    expect(fullView.activityFeed[0]?.type).toBe("submission");
  });
});
