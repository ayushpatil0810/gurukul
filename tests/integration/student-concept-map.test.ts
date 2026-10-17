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
  prerequisites,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { getStudentCurriculumRoadmap } from "@/lib/services/concepts";

const instituteId = crypto.randomUUID();
const studentId = crypto.randomUUID();
const batchId = crypto.randomUUID();
const moduleId1 = crypto.randomUUID();
const moduleId2 = crypto.randomUUID();

// 10 concepts for Course 1
const conceptIds = Array.from({ length: 10 }, () => crypto.randomUUID());
// 2 concepts for Course 2
const course2ConceptIds = [crypto.randomUUID(), crypto.randomUUID()];

const studentActor: Actor = {
  id: studentId,
  name: "Alex Learner",
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

describe("Student Concept Map & Course Roadmap Service", () => {
  it("provides detailed visual representation of enrolled courses, 10 modules, progress tracking, and flow sequence", async () => {
    // 1. Setup institute, batch, student
    await db.insert(institutes).values({ id: instituteId, name: `Tech Institute ${instituteId}` });
    await db.insert(batches).values({ id: batchId, instituteId, name: "2026 Engineering Cohort" });
    await db.insert(user).values({
      id: studentId,
      name: "Alex Learner",
      email: `${studentId}@example.com`,
      role: "student",
      instituteId,
    });
    await db.insert(batchMembers).values({ batchId, studentId, instituteId });

    // 2. Setup 10 concepts for Course 1
    const conceptNames = [
      "Variables & Primitives",
      "Control Flow & Loops",
      "Functions & Closures",
      "Data Structures",
      "Async Event Loop",
      "Relational Database",
      "HTTP & REST API",
      "Authentication & JWT",
      "Containerization",
      "Distributed Architecture", // Capstone Goal
    ];

    await db.insert(concepts).values(
      conceptIds.map((id, index) => ({
        id,
        instituteId,
        name: conceptNames[index]!,
        description: `Deep dive into ${conceptNames[index]} with architectural patterns and test benchmarks.`,
      })),
    );

    // 3. Setup Course 1 (10 modules, capstone goal is conceptIds[9])
    await db.insert(modules).values({
      id: moduleId1,
      instituteId,
      name: "Full-Stack Software Architecture",
      goalConceptId: conceptIds[9]!,
      masteryThreshold: 0.8,
    });

    await db.insert(moduleConcepts).values(
      conceptIds.map((conceptId) => ({
        moduleId: moduleId1,
        conceptId,
        instituteId,
      })),
    );

    // 4. Setup Course 2 (DevOps Track)
    await db.insert(concepts).values([
      { id: course2ConceptIds[0]!, instituteId, name: "Linux Systems", description: "POSIX and shell" },
      { id: course2ConceptIds[1]!, instituteId, name: "K8s Clusters", description: "Cluster orchestration" },
    ]);
    await db.insert(modules).values({
      id: moduleId2,
      instituteId,
      name: "Cloud & DevOps Track",
      goalConceptId: course2ConceptIds[1]!,
      masteryThreshold: 0.85,
    });
    await db.insert(moduleConcepts).values([
      { moduleId: moduleId2, conceptId: course2ConceptIds[0]!, instituteId },
      { moduleId: moduleId2, conceptId: course2ConceptIds[1]!, instituteId },
    ]);

    // 5. Connect prerequisite flow (Kahn's DAG edges):
    // Variables -> Control Flow -> Functions -> Data Structures -> Async
    // Functions -> HTTP API -> Auth
    // Async + Relational DB -> Distributed Architecture
    await db.insert(prerequisites).values([
      { conceptId: conceptIds[1]!, requiresId: conceptIds[0]!, instituteId }, // Control Flow requires Variables
      { conceptId: conceptIds[2]!, requiresId: conceptIds[1]!, instituteId }, // Functions requires Control Flow
      { conceptId: conceptIds[3]!, requiresId: conceptIds[2]!, instituteId }, // Data Structures requires Functions
      { conceptId: conceptIds[4]!, requiresId: conceptIds[3]!, instituteId }, // Async requires Data Structures
      { conceptId: conceptIds[6]!, requiresId: conceptIds[2]!, instituteId }, // API requires Functions
      { conceptId: conceptIds[7]!, requiresId: conceptIds[6]!, instituteId }, // Auth requires API
      { conceptId: conceptIds[9]!, requiresId: conceptIds[4]!, instituteId }, // Distributed requires Async
      { conceptId: conceptIds[9]!, requiresId: conceptIds[5]!, instituteId }, // Distributed requires DB
    ]);

    // 6. Record student mastery progress:
    // Variables: 95% (Solid / Mastered)
    // Control Flow: 88% (Solid / Mastered)
    // Functions: 60% (In Progress / Developing)
    await db.insert(masteryState).values([
      { studentId, conceptId: conceptIds[0]!, instituteId, pKnow: 0.95, confidence: 0.9 },
      { studentId, conceptId: conceptIds[1]!, instituteId, pKnow: 0.88, confidence: 0.85 },
      { studentId, conceptId: conceptIds[2]!, instituteId, pKnow: 0.6, confidence: 0.7 },
    ]);

    // 7. Execute service call
    const roadmap = await getStudentCurriculumRoadmap(studentActor, moduleId1);

    // Assertions: Enrolled Courses
    expect(roadmap.courses.length).toBe(2);
    const course1 = roadmap.courses.find((c) => c.id === moduleId1)!;
    expect(course1).toBeDefined();
    expect(course1.name).toBe("Full-Stack Software Architecture");
    expect(course1.totalModulesCount).toBe(10);
    expect(course1.masteredCount).toBe(2); // Variables and Control Flow are >= 0.8
    expect(course1.inProgressCount).toBe(1); // Functions is 0.6
    expect(course1.completionRate).toBe(0.2); // 2/10 = 20%
    expect(course1.goalConceptName).toBe("Distributed Architecture");

    // Assertions: Active Course details
    expect(roadmap.activeCourse).not.toBeNull();
    const active = roadmap.activeCourse!;
    expect(active.id).toBe(moduleId1);
    expect(active.name).toBe("Full-Stack Software Architecture");
    expect(active.description).toContain("Full-Stack Software Architecture");
    expect(active.modules.length).toBe(10);

    // Assertions: Topological flow ordering
    // Variables (step 1) must come before Control Flow (step 2) which must come before Functions (step 3)
    const varIdx = active.modules.findIndex((m) => m.name === "Variables & Primitives");
    const flowIdx = active.modules.findIndex((m) => m.name === "Control Flow & Loops");
    const fnIdx = active.modules.findIndex((m) => m.name === "Functions & Closures");
    const distIdx = active.modules.findIndex((m) => m.name === "Distributed Architecture");

    expect(varIdx).toBeLessThan(flowIdx);
    expect(flowIdx).toBeLessThan(fnIdx);
    expect(fnIdx).toBeLessThan(distIdx);

    // Assertions: Module progress tracking
    const varMod = active.modules.find((m) => m.name === "Variables & Primitives")!;
    expect(varMod.status).toBe("Mastered");
    expect(varMod.pKnow).toBe(0.95);
    expect(varMod.prerequisites.length).toBe(0);
    expect(varMod.allPrerequisitesMet).toBe(true);

    const flowMod = active.modules.find((m) => m.name === "Control Flow & Loops")!;
    expect(flowMod.status).toBe("Mastered");
    expect(flowMod.prerequisites[0]?.name).toBe("Variables & Primitives");
    expect(flowMod.prerequisites[0]?.state).toBe("met");

    const fnMod = active.modules.find((m) => m.name === "Functions & Closures")!;
    expect(fnMod.status).toBe("In Progress");
    expect(fnMod.pKnow).toBe(0.6);
    expect(fnMod.allPrerequisitesMet).toBe(true); // Control flow is met (0.88 >= 0.80)

    // Assertions: Flow edges
    expect(active.flowEdges.length).toBe(8);
    const edgeVarToFlow = active.flowEdges.find(
      (e) => e.sourceName === "Variables & Primitives" && e.targetName === "Control Flow & Loops",
    );
    expect(edgeVarToFlow).toBeDefined();
    expect(edgeVarToFlow?.isMet).toBe(true);

    // Assertions: Next Recommended Step
    // Since Functions is in progress and all prerequisites are met, it should be the focus!
    expect(active.prerequisiteFlowSummary.nextRecommendedModule?.name).toBe("Functions & Closures");
  });
});
