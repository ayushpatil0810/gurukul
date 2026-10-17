import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assignments,
  batchMembers,
  batches,
  concepts,
  masteryState,
  moduleConcepts,
  modules,
  prerequisites,
  questionConcepts,
  user,
} from "@/db/schema";
import { assertActorRole, type Actor } from "@/lib/auth/actor";
import { checkPrerequisiteEdge } from "@/lib/engine/cycles";
import { layoutConceptMap } from "@/lib/engine/concept-layout";
import { masteryBand, orderByPrerequisite, type MasteryBand } from "@/lib/engine/dashboard-bands";
import { AppError } from "@/lib/errors";

function instituteIdOf(actor: Actor): string {
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute");
  }
  return actor.instituteId;
}

export async function listConceptMap(actor: Actor) {
  const instituteId = instituteIdOf(actor);
  const [conceptRows, edgeRows, moduleRows, linkRows] = await Promise.all([
    db.select().from(concepts).where(eq(concepts.instituteId, instituteId)),
    db.select().from(prerequisites).where(eq(prerequisites.instituteId, instituteId)),
    db.select().from(modules).where(eq(modules.instituteId, instituteId)),
    db.select().from(moduleConcepts).where(eq(moduleConcepts.instituteId, instituteId)),
  ]);

  return {
    concepts: conceptRows.map((concept) => ({
      id: concept.id,
      name: concept.name,
      description: concept.description,
    })),
    prerequisites: edgeRows.map((edge) => ({
      conceptId: edge.conceptId,
      requiresId: edge.requiresId,
    })),
    modules: moduleRows.map((module) => ({
      id: module.id,
      name: module.name,
      goalConceptId: module.goalConceptId,
      masteryThreshold: module.masteryThreshold,
      conceptIds: linkRows
        .filter((link) => link.moduleId === module.id)
        .map((link) => link.conceptId),
    })),
  };
}

export async function createConcept(
  actor: Actor,
  input: { name: string; description?: string; moduleId?: string },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const description = input.description ?? "";

  const [existing] = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(and(eq(concepts.instituteId, instituteId), eq(concepts.name, input.name)))
    .limit(1);
  if (existing) throw AppError.conflict("A concept with that name already exists");

  if (input.moduleId) {
    const [module] = await db
      .select({ id: modules.id })
      .from(modules)
      .where(and(eq(modules.id, input.moduleId), eq(modules.instituteId, instituteId)))
      .limit(1);
    if (!module) throw AppError.notFound("Module not found");
  }

  const [created] = await db
    .insert(concepts)
    .values({ instituteId, name: input.name, description })
    .returning({ id: concepts.id, name: concepts.name, description: concepts.description });

  if (!created) throw AppError.internal();

  if (input.moduleId) {
    await db.insert(moduleConcepts).values({
      moduleId: input.moduleId,
      conceptId: created.id,
      instituteId,
    });
  }

  return created;
}

export async function updateConcept(
  actor: Actor,
  conceptId: string,
  input: { name?: string; description?: string },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const [current] = await db
    .select()
    .from(concepts)
    .where(and(eq(concepts.id, conceptId), eq(concepts.instituteId, instituteId)))
    .limit(1);
  if (!current) throw AppError.notFound("Concept not found");

  if (input.name && input.name !== current.name) {
    const [clash] = await db
      .select({ id: concepts.id })
      .from(concepts)
      .where(and(eq(concepts.instituteId, instituteId), eq(concepts.name, input.name)))
      .limit(1);
    if (clash) throw AppError.conflict("A concept with that name already exists");
  }

  const [updated] = await db
    .update(concepts)
    .set({
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      updatedAt: new Date(),
    })
    .where(eq(concepts.id, conceptId))
    .returning({ id: concepts.id, name: concepts.name, description: concepts.description });

  return updated;
}

export async function deleteConcept(actor: Actor, conceptId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const [current] = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(and(eq(concepts.id, conceptId), eq(concepts.instituteId, instituteId)))
    .limit(1);
  if (!current) throw AppError.notFound("Concept not found");

  const [tagged] = await db
    .select({ conceptId: questionConcepts.conceptId })
    .from(questionConcepts)
    .where(eq(questionConcepts.conceptId, conceptId))
    .limit(1);
  const [goal] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.goalConceptId, conceptId))
    .limit(1);
  const [linked] = await db
    .select({ conceptId: moduleConcepts.conceptId })
    .from(moduleConcepts)
    .where(eq(moduleConcepts.conceptId, conceptId))
    .limit(1);

  if (tagged || goal || linked) {
    throw AppError.conflict(
      "Remove this concept from modules and questions before deleting it",
    );
  }

  await db.delete(concepts).where(eq(concepts.id, conceptId));
}

export async function addPrerequisite(actor: Actor, conceptId: string, requiresId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  const conceptRows = await db
    .select({ id: concepts.id, name: concepts.name })
    .from(concepts)
    .where(eq(concepts.instituteId, instituteId));
  const names = new Map(conceptRows.map((concept) => [concept.id, concept.name]));
  if (!names.has(conceptId) || !names.has(requiresId)) {
    throw AppError.notFound("Concept not found");
  }

  const edgeRows = await db
    .select({ conceptId: prerequisites.conceptId, requiresId: prerequisites.requiresId })
    .from(prerequisites)
    .where(eq(prerequisites.instituteId, instituteId));

  if (edgeRows.some((edge) => edge.conceptId === conceptId && edge.requiresId === requiresId)) {
    throw AppError.conflict(
      `${names.get(requiresId)} is already a prerequisite of ${names.get(conceptId)}`,
    );
  }

  const cycle = checkPrerequisiteEdge(edgeRows, conceptId, requiresId, names);
  if (!cycle.ok) throw AppError.conflict(cycle.message);

  await db.insert(prerequisites).values({ conceptId, requiresId, instituteId });
  return { conceptId, requiresId };
}

export async function removePrerequisite(actor: Actor, conceptId: string, requiresId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const deleted = await db
    .delete(prerequisites)
    .where(
      and(
        eq(prerequisites.conceptId, conceptId),
        eq(prerequisites.requiresId, requiresId),
        eq(prerequisites.instituteId, instituteId),
      ),
    )
    .returning({ conceptId: prerequisites.conceptId });
  if (deleted.length === 0) throw AppError.notFound("Prerequisite not found");
}

export async function createModule(
  actor: Actor,
  input: {
    name: string;
    goalConceptId: string;
    masteryThreshold: number;
    conceptIds: string[];
  },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const uniqueConceptIds = [...new Set(input.conceptIds)];
  if (!uniqueConceptIds.includes(input.goalConceptId)) {
    throw AppError.validation("The goal concept must be part of the module");
  }

  const conceptRows = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(eq(concepts.instituteId, instituteId));
  const known = new Set(conceptRows.map((concept) => concept.id));
  if (uniqueConceptIds.some((id) => !known.has(id))) {
    throw AppError.notFound("Concept not found");
  }

  const [created] = await db
    .insert(modules)
    .values({
      instituteId,
      name: input.name,
      goalConceptId: input.goalConceptId,
      masteryThreshold: input.masteryThreshold,
    })
    .returning({
      id: modules.id,
      name: modules.name,
      goalConceptId: modules.goalConceptId,
      masteryThreshold: modules.masteryThreshold,
    });
  if (!created) throw AppError.internal();

  await db.insert(moduleConcepts).values(
    uniqueConceptIds.map((conceptId) => ({
      moduleId: created.id,
      conceptId,
      instituteId,
    })),
  );

  return { ...created, conceptIds: uniqueConceptIds };
}

export type StudentCourseModuleItem = {
  id: string;
  step: number;
  name: string;
  description: string;
  isGoal: boolean;
  pKnow: number | null;
  confidence: number;
  band: MasteryBand;
  status: "Mastered" | "In Progress" | "Ready to Learn" | "Prerequisites Blocked";
  prerequisites: {
    id: string;
    name: string;
    state: "met" | "below" | "not_recorded";
  }[];
  allPrerequisitesMet: boolean;
  unlocks: {
    id: string;
    name: string;
  }[];
  depth: number;
  x: number;
  y: number;
};

export type StudentEnrolledCourse = {
  id: string;
  name: string;
  description: string;
  goalConceptId: string;
  goalConceptName: string;
  masteryThreshold: number;
  totalModulesCount: number;
  masteredCount: number;
  inProgressCount: number;
  notStartedCount: number;
  completionRate: number;
  isEnrolled: boolean;
  batchName: string | null;
  status: "Mastered" | "In Progress" | "Not Started";
};

export type StudentCurriculumRoadmapView = {
  student: {
    id: string;
    name: string;
    role: string;
  };
  courses: StudentEnrolledCourse[];
  activeCourse: {
    id: string;
    name: string;
    description: string;
    goalConceptId: string;
    goalConceptName: string;
    masteryThreshold: number;
    totalModulesCount: number;
    masteredCount: number;
    completionRate: number;
    overallStatus: "Mastered" | "In Progress" | "Not Started";
    modules: StudentCourseModuleItem[];
    flowEdges: {
      id: string;
      source: string;
      target: string;
      sourceName: string;
      targetName: string;
      isMet: boolean;
    }[];
    prerequisiteFlowSummary: {
      foundationalCount: number;
      intermediateCount: number;
      advancedCount: number;
      nextRecommendedModule: StudentCourseModuleItem | null;
    };
  } | null;
  canEdit: boolean;
  rawConceptMap: {
    concepts: { id: string; name: string; description: string }[];
    prerequisites: { conceptId: string; requiresId: string }[];
    modules: { id: string; name: string; goalConceptId: string; masteryThreshold: number; conceptIds: string[] }[];
  };
};

function getConceptDescription(name: string, rawDesc?: string): string {
  if (rawDesc && rawDesc.trim().length > 0) return rawDesc.trim();
  const lower = name.toLowerCase();
  if (lower.includes("variable") || lower.includes("type")) {
    return "Memory layout, primitive vs reference types, stack/heap allocation, and immutable values.";
  }
  if (lower.includes("function") || lower.includes("closure") || lower.includes("scope")) {
    return "Call stacks, lexical scopes, closures, first-class functions, and recursion invariants.";
  }
  if (lower.includes("class") || lower.includes("oop") || lower.includes("object")) {
    return "Polymorphism, inheritance hierarchies, encapsulation boundaries, and prototype chains.";
  }
  if (lower.includes("async") || lower.includes("event") || lower.includes("promise")) {
    return "Microtask queues, event loop lifecycles, concurrency patterns, and asynchronous coordination.";
  }
  if (lower.includes("docker") || lower.includes("container")) {
    return "Linux namespaces, cgroups, multi-stage image builds, and container process isolation.";
  }
  if (lower.includes("kubernetes") || lower.includes("cluster") || lower.includes("k8s")) {
    return "Pod lifecycle orchestration, replica sets, readiness probes, and rolling update strategies.";
  }
  if (lower.includes("data structure") || lower.includes("tree") || lower.includes("graph")) {
    return "Fundamental abstract data types, asymptotic complexity analysis, and traversal algorithms.";
  }
  if (lower.includes("database") || lower.includes("sql") || lower.includes("index")) {
    return "Relational schemas, B-tree indexing strategies, ACID guarantees, and transaction isolation.";
  }
  if (lower.includes("api") || lower.includes("rest") || lower.includes("http")) {
    return "HTTP semantics, RESTful resource design, idempotency, serialization, and error contracts.";
  }
  if (lower.includes("security") || lower.includes("auth")) {
    return "Authentication handshakes, cryptographic signing, token lifecycles, and access control.";
  }
  return `Core engineering principles, architectural patterns, and practical implementation for ${name}.`;
}

export async function getStudentCurriculumRoadmap(
  actor: Actor,
  preferredModuleId?: string,
): Promise<StudentCurriculumRoadmapView> {
  const instituteId = instituteIdOf(actor);
  const studentId = actor.id;

  // 1. Fetch core rows for this institute
  const [conceptRows, edgeRows, moduleRows, linkRows, masteryRows, batchRows] = await Promise.all([
    db.select().from(concepts).where(eq(concepts.instituteId, instituteId)),
    db.select().from(prerequisites).where(eq(prerequisites.instituteId, instituteId)),
    db.select().from(modules).where(eq(modules.instituteId, instituteId)),
    db.select().from(moduleConcepts).where(eq(moduleConcepts.instituteId, instituteId)),
    db.select().from(masteryState).where(and(eq(masteryState.instituteId, instituteId), eq(masteryState.studentId, studentId))),
    db
      .select({ batchId: batchMembers.batchId, batchName: batches.name })
      .from(batchMembers)
      .innerJoin(batches, eq(batches.id, batchMembers.batchId))
      .where(eq(batchMembers.studentId, studentId)),
  ]);

  const batchIds = batchRows.map((b) => b.batchId);
  const assignmentRows =
    batchIds.length > 0
      ? await db
          .select({ moduleId: assignments.moduleId })
          .from(assignments)
          .where(inArray(assignments.batchId, batchIds))
      : [];

  const assignedModuleIds = new Set(assignmentRows.map((a) => a.moduleId));
  const conceptMap = new Map(conceptRows.map((c) => [c.id, c]));
  const masteryMap = new Map(masteryRows.map((m) => [m.conceptId, m]));
  const primaryBatchName = batchRows[0]?.batchName ?? null;

  // 2. Build list of courses (modules)
  const courses: StudentEnrolledCourse[] = moduleRows.map((m) => {
    const cIds = linkRows.filter((l) => l.moduleId === m.id).map((l) => l.conceptId);
    const goal = conceptMap.get(m.goalConceptId);
    const masteredCount = cIds.filter((id) => (masteryMap.get(id)?.pKnow ?? 0) >= m.masteryThreshold).length;
    const inProgressCount = cIds.filter((id) => {
      const p = masteryMap.get(id)?.pKnow ?? null;
      return p !== null && p > 0 && p < m.masteryThreshold;
    }).length;
    const notStartedCount = Math.max(0, cIds.length - masteredCount - inProgressCount);
    const completionRate = cIds.length > 0 ? masteredCount / cIds.length : 0;
    const isEnrolled = assignedModuleIds.has(m.id) || batchRows.length > 0 || moduleRows.length === 1;

    return {
      id: m.id,
      name: m.name,
      description: `Comprehensive curriculum in ${m.name} structured across ${cIds.length} progressive modules. Takes students step-by-step through foundational prerequisites up to capstone mastery of ${goal?.name ?? "Course Goal"}.`,
      goalConceptId: m.goalConceptId,
      goalConceptName: goal?.name ?? "Goal Concept",
      masteryThreshold: m.masteryThreshold,
      totalModulesCount: cIds.length,
      masteredCount,
      inProgressCount,
      notStartedCount,
      completionRate,
      isEnrolled,
      batchName: primaryBatchName,
      status: completionRate >= 1 ? "Mastered" : completionRate > 0 ? "In Progress" : "Not Started",
    };
  });

  // 3. Resolve active course
  const activeCourseMeta =
    (preferredModuleId ? moduleRows.find((m) => m.id === preferredModuleId) : null) ??
    (moduleRows.length > 0 ? moduleRows[0] : null);

  let activeCourseData: StudentCurriculumRoadmapView["activeCourse"] = null;

  if (activeCourseMeta) {
    const activeConceptIds = linkRows
      .filter((l) => l.moduleId === activeCourseMeta.id)
      .map((l) => l.conceptId);

    const activeEdges = edgeRows.filter(
      (e) => activeConceptIds.includes(e.conceptId) && activeConceptIds.includes(e.requiresId),
    );

    const orderedIds = orderByPrerequisite(activeConceptIds, activeEdges);
    const layout = layoutConceptMap(
      orderedIds.map((id) => conceptMap.get(id)!).filter(Boolean),
      activeEdges,
    );
    const posMap = new Map(layout.map((p) => [p.id, p]));

    const prereqsOfConcept = new Map<string, string[]>();
    const unlocksOfConcept = new Map<string, string[]>();
    for (const id of activeConceptIds) {
      prereqsOfConcept.set(id, []);
      unlocksOfConcept.set(id, []);
    }
    for (const e of activeEdges) {
      prereqsOfConcept.get(e.conceptId)?.push(e.requiresId);
      unlocksOfConcept.get(e.requiresId)?.push(e.conceptId);
    }

    const modulesList: StudentCourseModuleItem[] = orderedIds.map((conceptId, index) => {
      const concept = conceptMap.get(conceptId);
      const name = concept?.name ?? conceptId;
      const description = getConceptDescription(name, concept?.description);
      const mRecord = masteryMap.get(conceptId);
      const pKnow = mRecord?.pKnow ?? null;
      const confidence = mRecord?.confidence ?? 0;
      const band = masteryBand(pKnow, activeCourseMeta.masteryThreshold);
      const isGoal = conceptId === activeCourseMeta.goalConceptId;

      const incomingReqs = prereqsOfConcept.get(conceptId) ?? [];
      const prerequisites = incomingReqs.map((reqId) => {
        const reqName = conceptMap.get(reqId)?.name ?? reqId;
        const reqMastery = masteryMap.get(reqId)?.pKnow ?? null;
        const state: "met" | "below" | "not_recorded" =
          reqMastery === null
            ? "not_recorded"
            : reqMastery >= activeCourseMeta.masteryThreshold
              ? "met"
              : "below";
        return { id: reqId, name: reqName, state };
      });

      const allPrerequisitesMet = prerequisites.every((p) => p.state === "met");

      let status: StudentCourseModuleItem["status"] = "Ready to Learn";
      if (band === "solid") {
        status = "Mastered";
      } else if (pKnow !== null && pKnow > 0) {
        status = "In Progress";
      } else if (allPrerequisitesMet) {
        status = "Ready to Learn";
      } else {
        status = "Prerequisites Blocked";
      }

      const outgoing = unlocksOfConcept.get(conceptId) ?? [];
      const unlocks = outgoing.map((uId) => ({
        id: uId,
        name: conceptMap.get(uId)?.name ?? uId,
      }));

      const pos = posMap.get(conceptId) ?? { x: index * 260, y: 0 };

      return {
        id: conceptId,
        step: index + 1,
        name,
        description,
        isGoal,
        pKnow,
        confidence,
        band,
        status,
        prerequisites,
        allPrerequisitesMet,
        unlocks,
        depth: Math.floor(pos.x / 260),
        x: pos.x,
        y: pos.y,
      };
    });

    const masteredCount = modulesList.filter((m) => m.status === "Mastered").length;
    const completionRate = modulesList.length > 0 ? masteredCount / modulesList.length : 0;
    const goalConcept = conceptMap.get(activeCourseMeta.goalConceptId);

    const flowEdges = activeEdges.map((e) => {
      const sourceName = conceptMap.get(e.requiresId)?.name ?? e.requiresId;
      const targetName = conceptMap.get(e.conceptId)?.name ?? e.conceptId;
      const isMet = (masteryMap.get(e.requiresId)?.pKnow ?? 0) >= activeCourseMeta.masteryThreshold;
      return {
        id: `${e.requiresId}->${e.conceptId}`,
        source: e.requiresId,
        target: e.conceptId,
        sourceName,
        targetName,
        isMet,
      };
    });

    const foundationalCount = modulesList.filter((m) => m.prerequisites.length === 0).length;
    const intermediateCount = modulesList.filter(
      (m) => m.prerequisites.length === 1 && !m.isGoal,
    ).length;
    const advancedCount = modulesList.filter(
      (m) => m.prerequisites.length >= 2 || m.isGoal,
    ).length;
    const nextRecommendedModule =
      modulesList.find((m) => m.status === "In Progress" && m.allPrerequisitesMet) ??
      modulesList.find((m) => m.status === "Ready to Learn") ??
      null;

    activeCourseData = {
      id: activeCourseMeta.id,
      name: activeCourseMeta.name,
      description: `Comprehensive curriculum in ${activeCourseMeta.name} structured across ${modulesList.length} progressive modules. Takes students step-by-step through foundational prerequisites up to capstone mastery of ${goalConcept?.name ?? "Course Goal"}.`,
      goalConceptId: activeCourseMeta.goalConceptId,
      goalConceptName: goalConcept?.name ?? "Goal Concept",
      masteryThreshold: activeCourseMeta.masteryThreshold,
      totalModulesCount: modulesList.length,
      masteredCount,
      completionRate,
      overallStatus:
        completionRate >= 1 ? "Mastered" : completionRate > 0 ? "In Progress" : "Not Started",
      modules: modulesList,
      flowEdges,
      prerequisiteFlowSummary: {
        foundationalCount,
        intermediateCount,
        advancedCount,
        nextRecommendedModule,
      },
    };
  }

  return {
    student: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    },
    courses,
    activeCourse: activeCourseData,
    canEdit: actor.role === "trainer" || actor.role === "admin",
    rawConceptMap: {
      concepts: conceptRows.map((c) => ({ id: c.id, name: c.name, description: c.description })),
      prerequisites: edgeRows.map((e) => ({ conceptId: e.conceptId, requiresId: e.requiresId })),
      modules: moduleRows.map((m) => ({
        id: m.id,
        name: m.name,
        goalConceptId: m.goalConceptId,
        masteryThreshold: m.masteryThreshold,
        conceptIds: linkRows.filter((l) => l.moduleId === m.id).map((l) => l.conceptId),
      })),
    },
  };
}
