import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  institutes,
  concepts,
  modules,
  moduleConcepts,
  masteryState,
  prerequisites,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { getCourseLearnData } from "@/lib/services/learn-module";

const instituteId = crypto.randomUUID();
const studentId = crypto.randomUUID();
const moduleId1 = crypto.randomUUID();
const moduleId2 = crypto.randomUUID();

const c1 = crypto.randomUUID();
const c2 = crypto.randomUUID();
const c3 = crypto.randomUUID();
const c4 = crypto.randomUUID();

const studentActor: Actor = {
  id: studentId,
  name: "Sam Student",
  email: `${studentId}@example.com`,
  role: "student",
  instituteId,
};

afterAll(async () => {
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("Learn Module: Two Tabs, LearnWin Docs & Slides, 70% Minimum Quiz Gate, and Concept Map Mapping", () => {
  it("maps concepts with steps, prerequisites, unlocks, docs, slides, and enforces 70% passing requirement", async () => {
    // 1. Setup institute & student
    await db.insert(institutes).values({ id: instituteId, name: `Institute ${instituteId}` });
    await db.insert(user).values({
      id: studentId,
      name: "Sam Student",
      email: `${studentId}@example.com`,
      role: "student",
      instituteId,
    });

    // 2. Setup 3 concepts with prerequisites (c1 -> c2 -> c3)
    await db.insert(concepts).values([
      { id: c1, instituteId, name: "Variables & Scopes", description: "Memory layout and const vs let." },
      { id: c2, instituteId, name: "Functions & Closures", description: "Lexical scoping and first-class functions." },
      { id: c3, instituteId, name: "Classes & Objects", description: "Encapsulation, constructors, and prototypes." },
      { id: c4, instituteId, name: "Async & Promises", description: "Microtask queue and event loops." },
    ]);

    await db.insert(prerequisites).values([
      { conceptId: c2, requiresId: c1, instituteId },
      { conceptId: c3, requiresId: c2, instituteId },
    ]);

    // 3. Setup 2 modules (Course 1 and Course 2)
    await db.insert(modules).values([
      { id: moduleId1, instituteId, name: "Core Software Engineering", goalConceptId: c3, masteryThreshold: 0.8 },
      { id: moduleId2, instituteId, name: "Advanced Concurrency", goalConceptId: c4, masteryThreshold: 0.85 },
    ]);

    await db.insert(moduleConcepts).values([
      { moduleId: moduleId1, conceptId: c1, instituteId },
      { moduleId: moduleId1, conceptId: c2, instituteId },
      { moduleId: moduleId1, conceptId: c3, instituteId },
      { moduleId: moduleId2, conceptId: c4, instituteId },
    ]);

    // 4. Set mastery for c1 (Mastered)
    await db.insert(masteryState).values({
      studentId,
      conceptId: c1,
      instituteId,
      pKnow: 0.9,
      confidence: 0.8,
    });

    // 5. Test getCourseLearnData
    const data = await getCourseLearnData(studentActor, moduleId1);

    expect(data.module).not.toBeNull();
    expect(data.module?.name).toBe("Core Software Engineering");
    expect(data.availableModules.length).toBe(2);

    // Verify concepts topological sequence (c1, then c2, then c3)
    expect(data.concepts.length).toBe(3);
    expect(data.concepts[0].id).toBe(c1);
    expect(data.concepts[0].step).toBe(1);
    expect(data.concepts[0].conceptMapStatus).toBe("Mastered");
    expect(data.concepts[0].unlocks.length).toBe(1);
    expect(data.concepts[0].unlocks[0].id).toBe(c2);

    expect(data.concepts[1].id).toBe(c2);
    expect(data.concepts[1].step).toBe(2);
    expect(data.concepts[1].prerequisites[0].id).toBe(c1);
    expect(data.concepts[1].prerequisites[0].met).toBe(true);
    expect(data.concepts[1].conceptMapStatus).toBe("Ready to Learn");
    expect(data.concepts[1].unlocks[0].id).toBe(c3);

    expect(data.concepts[2].id).toBe(c3);
    expect(data.concepts[2].step).toBe(3);
    expect(data.concepts[2].isGoal).toBe(true);
    expect(data.concepts[2].prerequisites[0].id).toBe(c2);
    expect(data.concepts[2].prerequisites[0].met).toBe(false); // c2 not mastered yet
    expect(data.concepts[2].conceptMapStatus).toBe("Prerequisites Blocked");

    // Verify rich docs & slides generated for LearnWin
    for (const concept of data.concepts) {
      expect(concept.docs).toBeDefined();
      expect(concept.docs.conceptName).toBe(concept.name);
      expect(concept.docs.title.length).toBeGreaterThan(0);
      expect(concept.docs.sections.length).toBeGreaterThan(0);
      expect(concept.slides).toBeDefined();
      expect(concept.slides.length).toBeGreaterThanOrEqual(4);
      expect(concept.quiz.passingScorePercent).toBe(70);
      expect(concept.quiz.questions.length).toBeGreaterThanOrEqual(3);
    }
  });
});
