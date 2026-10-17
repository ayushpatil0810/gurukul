import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  batchMembers,
  batchTrainers,
  batches,
  concepts,
  courseBatches,
  courseModules,
  courses,
  moduleConcepts,
  modules,
  prerequisites,
  sectionConcepts,
  sections,
  user,
} from "@/db/schema";
import { assertActorRole, type Actor } from "@/lib/auth/actor";
import { checkPrerequisiteEdge } from "@/lib/engine/cycles";
import { AppError } from "@/lib/errors";

function instituteIdOf(actor: Actor): string {
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute");
  }
  return actor.instituteId;
}

export type CourseSummaryItem = {
  id: string;
  name: string;
  code: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  status: "draft" | "published" | "archived";
  masteryThreshold: number;
  goalConcept: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  modulesCount: number;
  sectionsCount: number;
  conceptsCount: number;
  batches: { id: string; name: string }[];
  enrolledStudentsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CourseDetailView = {
  course: {
    id: string;
    name: string;
    code: string;
    description: string;
    level: "beginner" | "intermediate" | "advanced";
    status: "draft" | "published" | "archived";
    masteryThreshold: number;
    goalConceptId: string | null;
    goalConceptName: string | null;
    creatorName: string;
    createdAt: string;
    updatedAt: string;
  };
  modules: {
    id: string;
    name: string;
    masteryThreshold: number;
    orderIndex: number;
    sections: {
      id: string;
      title: string;
      description: string;
      orderIndex: number;
      concepts: {
        id: string;
        name: string;
        description: string;
        orderIndex: number;
      }[];
    }[];
  }[];
  courseConcepts: {
    id: string;
    name: string;
    description: string;
    moduleId: string;
    moduleName: string;
    sectionId: string;
    sectionTitle: string;
    orderIndex: number;
  }[];
  coursePrerequisites: { conceptId: string; requiresId: string }[];
  availableConcepts: { id: string; name: string; description: string }[];
  prerequisites: { conceptId: string; requiresId: string }[];
  assignedBatches: {
    id: string;
    name: string;
    deadline: string | null;
    studentCount: number;
  }[];
  availableBatches: {
    id: string;
    name: string;
    assigned: boolean;
  }[];
  validation: {
    canPublish: boolean;
    issues: string[];
  };
};

/**
 * Lists all courses visible to the actor with at-a-glance metrics.
 */
export async function listCourses(
  actor: Actor,
  filter: { batchId?: string; status?: string; search?: string } = {},
): Promise<CourseSummaryItem[]> {
  const instituteId = instituteIdOf(actor);

  // 1. Fetch base courses in institute
  const allCourses = await db
    .select({
      id: courses.id,
      name: courses.name,
      code: courses.code,
      description: courses.description,
      level: courses.level,
      status: courses.status,
      masteryThreshold: courses.masteryThreshold,
      goalConceptId: courses.goalConceptId,
      createdBy: courses.createdBy,
      creatorName: user.name,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .innerJoin(user, eq(courses.createdBy, user.id))
    .where(eq(courses.instituteId, instituteId))
    .orderBy(desc(courses.updatedAt));

  if (allCourses.length === 0) return [];

  const courseIds = allCourses.map((c) => c.id);

  // 2. Fetch course-module mappings & modules
  const cmRows = await db
    .select({
      courseId: courseModules.courseId,
      moduleId: courseModules.moduleId,
      orderIndex: courseModules.orderIndex,
      moduleName: modules.name,
    })
    .from(courseModules)
    .innerJoin(modules, eq(courseModules.moduleId, modules.id))
    .where(inArray(courseModules.courseId, courseIds));

  const allModuleIds = [...new Set(cmRows.map((r) => r.moduleId))];

  // 3. Fetch sections for these modules
  const sectionRows =
    allModuleIds.length > 0
      ? await db
          .select({
            id: sections.id,
            moduleId: sections.moduleId,
            title: sections.title,
            orderIndex: sections.orderIndex,
          })
          .from(sections)
          .where(inArray(sections.moduleId, allModuleIds))
      : [];

  const allSectionIds = sectionRows.map((s) => s.id);

  // 4. Fetch section concepts
  const scRows =
    allSectionIds.length > 0
      ? await db
          .select({
            sectionId: sectionConcepts.sectionId,
            conceptId: sectionConcepts.conceptId,
          })
          .from(sectionConcepts)
          .where(inArray(sectionConcepts.sectionId, allSectionIds))
      : [];

  // Also count module concepts directly linked
  const mcRows =
    allModuleIds.length > 0
      ? await db
          .select({
            moduleId: moduleConcepts.moduleId,
            conceptId: moduleConcepts.conceptId,
          })
          .from(moduleConcepts)
          .where(inArray(moduleConcepts.moduleId, allModuleIds))
      : [];

  // 5. Fetch assigned batches
  const cbRows = await db
    .select({
      courseId: courseBatches.courseId,
      batchId: courseBatches.batchId,
      batchName: batches.name,
    })
    .from(courseBatches)
    .innerJoin(batches, eq(courseBatches.batchId, batches.id))
    .where(inArray(courseBatches.courseId, courseIds));

  // 6. Fetch batch members count
  const allBatchIds = [...new Set(cbRows.map((r) => r.batchId))];
  const membersRows =
    allBatchIds.length > 0
      ? await db
          .select({
            batchId: batchMembers.batchId,
            studentId: batchMembers.studentId,
          })
          .from(batchMembers)
          .where(inArray(batchMembers.batchId, allBatchIds))
      : [];

  // 7. Fetch goal concept names
  const allGoalConceptIds = allCourses
    .map((c) => c.goalConceptId)
    .filter((id): id is string => Boolean(id));

  const goalConceptRows =
    allGoalConceptIds.length > 0
      ? await db
          .select({ id: concepts.id, name: concepts.name })
          .from(concepts)
          .where(inArray(concepts.id, allGoalConceptIds))
      : [];
  const goalConceptMap = new Map(goalConceptRows.map((g) => [g.id, g.name]));

  // Assemble summary items
  const items: CourseSummaryItem[] = allCourses.map((c) => {
    const courseModIds = cmRows.filter((cm) => cm.courseId === c.id).map((cm) => cm.moduleId);
    const courseSecs = sectionRows.filter((s) => courseModIds.includes(s.moduleId));
    const courseSecIds = courseSecs.map((s) => s.id);

    // Concept IDs from sections or moduleConcepts
    const secConceptIds = scRows
      .filter((sc) => courseSecIds.includes(sc.sectionId))
      .map((sc) => sc.conceptId);
    const modConceptIds = mcRows
      .filter((mc) => courseModIds.includes(mc.moduleId))
      .map((mc) => mc.conceptId);
    const uniqueConcepts = new Set([...secConceptIds, ...modConceptIds]);

    const assignedB = cbRows.filter((cb) => cb.courseId === c.id);
    const assignedBatchIds = assignedB.map((b) => b.batchId);
    const studentsInBatches = new Set(
      membersRows.filter((m) => assignedBatchIds.includes(m.batchId)).map((m) => m.studentId),
    );

    return {
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      level: c.level as "beginner" | "intermediate" | "advanced",
      status: c.status as "draft" | "published" | "archived",
      masteryThreshold: c.masteryThreshold,
      goalConcept: c.goalConceptId
        ? {
            id: c.goalConceptId,
            name: goalConceptMap.get(c.goalConceptId) ?? "Goal Concept",
          }
        : null,
      createdBy: {
        id: c.createdBy,
        name: c.creatorName,
      },
      modulesCount: courseModIds.length,
      sectionsCount: courseSecs.length,
      conceptsCount: uniqueConcepts.size,
      batches: assignedB.map((b) => ({ id: b.batchId, name: b.batchName })),
      enrolledStudentsCount: studentsInBatches.size,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  });

  // Apply filters if provided
  let filtered = items;
  if (filter.status && filter.status !== "all") {
    filtered = filtered.filter((i) => i.status === filter.status);
  }
  if (filter.batchId) {
    filtered = filtered.filter((i) => i.batches.some((b) => b.id === filter.batchId));
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    filtered = filtered.filter(
      (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  }

  return filtered;
}

/**
 * Returns complete course detail including modules, sections, concepts, and DAG checks.
 */
export async function getCourseDetail(actor: Actor, courseId: string): Promise<CourseDetailView> {
  const instituteId = instituteIdOf(actor);

  const [courseRow] = await db
    .select({
      id: courses.id,
      name: courses.name,
      code: courses.code,
      description: courses.description,
      level: courses.level,
      status: courses.status,
      masteryThreshold: courses.masteryThreshold,
      goalConceptId: courses.goalConceptId,
      createdBy: courses.createdBy,
      creatorName: user.name,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .innerJoin(user, eq(courses.createdBy, user.id))
    .where(and(eq(courses.id, courseId), eq(courses.instituteId, instituteId)))
    .limit(1);

  if (!courseRow) throw AppError.notFound("Course not found");

  // Fetch goal concept name if exists
  let goalConceptName: string | null = null;
  if (courseRow.goalConceptId) {
    const [g] = await db
      .select({ name: concepts.name })
      .from(concepts)
      .where(eq(concepts.id, courseRow.goalConceptId))
      .limit(1);
    goalConceptName = g?.name ?? null;
  }

  // Fetch modules ordered by orderIndex
  const courseModRows = await db
    .select({
      id: modules.id,
      name: modules.name,
      masteryThreshold: modules.masteryThreshold,
      orderIndex: courseModules.orderIndex,
    })
    .from(courseModules)
    .innerJoin(modules, eq(courseModules.moduleId, modules.id))
    .where(eq(courseModules.courseId, courseId))
    .orderBy(asc(courseModules.orderIndex));

  const modIds = courseModRows.map((m) => m.id);

  // Fetch sections for all modules
  const sectionRows =
    modIds.length > 0
      ? await db
          .select({
            id: sections.id,
            moduleId: sections.moduleId,
            title: sections.title,
            description: sections.description,
            orderIndex: sections.orderIndex,
          })
          .from(sections)
          .where(inArray(sections.moduleId, modIds))
          .orderBy(asc(sections.orderIndex))
      : [];

  const secIds = sectionRows.map((s) => s.id);

  // Fetch section concepts
  const secConceptRows =
    secIds.length > 0
      ? await db
          .select({
            sectionId: sectionConcepts.sectionId,
            conceptId: sectionConcepts.conceptId,
            orderIndex: sectionConcepts.orderIndex,
            name: concepts.name,
            description: concepts.description,
          })
          .from(sectionConcepts)
          .innerJoin(concepts, eq(sectionConcepts.conceptId, concepts.id))
          .where(inArray(sectionConcepts.sectionId, secIds))
          .orderBy(asc(sectionConcepts.orderIndex))
      : [];

  // Group into hierarchy
  const moduleViews = courseModRows.map((m) => {
    const modSections = sectionRows
      .filter((s) => s.moduleId === m.id)
      .map((s) => {
        const sConcepts = secConceptRows
          .filter((sc) => sc.sectionId === s.id)
          .map((sc) => ({
            id: sc.conceptId,
            name: sc.name,
            description: sc.description,
            orderIndex: sc.orderIndex,
          }));
        return {
          id: s.id,
          title: s.title,
          description: s.description,
          orderIndex: s.orderIndex,
          concepts: sConcepts,
        };
      });

    return {
      id: m.id,
      name: m.name,
      masteryThreshold: m.masteryThreshold,
      orderIndex: m.orderIndex,
      sections: modSections,
    };
  });

  // Fetch all available concepts in institute
  const availableConcepts = await db
    .select({
      id: concepts.id,
      name: concepts.name,
      description: concepts.description,
    })
    .from(concepts)
    .where(eq(concepts.instituteId, instituteId))
    .orderBy(asc(concepts.name));

  // Fetch all prerequisite edges
  const edgeRows = await db
    .select({
      conceptId: prerequisites.conceptId,
      requiresId: prerequisites.requiresId,
    })
    .from(prerequisites)
    .where(eq(prerequisites.instituteId, instituteId));

  // Fetch assigned batches with student counts
  const assignedBatchRows = await db
    .select({
      id: batches.id,
      name: batches.name,
      deadline: courseBatches.deadline,
    })
    .from(courseBatches)
    .innerJoin(batches, eq(courseBatches.batchId, batches.id))
    .where(eq(courseBatches.courseId, courseId));

  const assignedBatchIds = assignedBatchRows.map((b) => b.id);
  const batchStudents =
    assignedBatchIds.length > 0
      ? await db
          .select({
            batchId: batchMembers.batchId,
            studentId: batchMembers.studentId,
          })
          .from(batchMembers)
          .where(inArray(batchMembers.batchId, assignedBatchIds))
      : [];

  const assignedBatches = assignedBatchRows.map((b) => ({
    id: b.id,
    name: b.name,
    deadline: b.deadline ? b.deadline.toISOString() : null,
    studentCount: batchStudents.filter((s) => s.batchId === b.id).length,
  }));

  // Fetch all institute batches to present assignment picker
  const allInstituteBatches = await db
    .select({
      id: batches.id,
      name: batches.name,
    })
    .from(batches)
    .where(eq(batches.instituteId, instituteId))
    .orderBy(asc(batches.name));

  const availableBatches = allInstituteBatches.map((b) => ({
    id: b.id,
    name: b.name,
    assigned: assignedBatchIds.includes(b.id),
  }));

  // Perform pre-publication validation checklist
  const issues: string[] = [];
  if (moduleViews.length === 0) {
    issues.push("Course must contain at least one module");
  }
  const totalSections = moduleViews.reduce((acc, m) => acc + m.sections.length, 0);
  if (totalSections === 0) {
    issues.push("At least one section must be created inside your modules");
  }
  const totalConcepts = moduleViews.reduce(
    (acc, m) => acc + m.sections.reduce((sAcc, s) => sAcc + s.concepts.length, 0),
    0,
  );
  if (totalConcepts === 0) {
    issues.push("At least one concept must be mapped to a section");
  }
  if (!courseRow.goalConceptId) {
    issues.push("Course should define a target capstone goal concept");
  }

  // Collect all concepts belonging to this specific course's modules and sections
  const courseConceptsMap = new Map<
    string,
    {
      id: string;
      name: string;
      description: string;
      moduleId: string;
      moduleName: string;
      sectionId: string;
      sectionTitle: string;
      orderIndex: number;
    }
  >();

  for (const m of moduleViews) {
    for (const s of m.sections) {
      for (const c of s.concepts) {
        if (!courseConceptsMap.has(c.id)) {
          courseConceptsMap.set(c.id, {
            id: c.id,
            name: c.name,
            description: c.description,
            moduleId: m.id,
            moduleName: m.name,
            sectionId: s.id,
            sectionTitle: s.title,
            orderIndex: c.orderIndex,
          });
        }
      }
    }
  }

  const courseConcepts = Array.from(courseConceptsMap.values());
  const courseConceptIdSet = new Set(courseConcepts.map((c) => c.id));
  const coursePrerequisites = edgeRows.filter(
    (e) => courseConceptIdSet.has(e.conceptId) && courseConceptIdSet.has(e.requiresId),
  );

  return {
    course: {
      id: courseRow.id,
      name: courseRow.name,
      code: courseRow.code,
      description: courseRow.description,
      level: courseRow.level as "beginner" | "intermediate" | "advanced",
      status: courseRow.status as "draft" | "published" | "archived",
      masteryThreshold: courseRow.masteryThreshold,
      goalConceptId: courseRow.goalConceptId,
      goalConceptName,
      creatorName: courseRow.creatorName,
      createdAt: courseRow.createdAt.toISOString(),
      updatedAt: courseRow.updatedAt.toISOString(),
    },
    modules: moduleViews,
    courseConcepts,
    coursePrerequisites,
    availableConcepts,
    prerequisites: edgeRows,
    assignedBatches,
    availableBatches,
    validation: {
      canPublish: issues.length === 0,
      issues,
    },
  };
}

/**
 * Creates a new course and provisions initial modules/batches if supplied.
 */
export async function createCourse(
  actor: Actor,
  input: {
    name: string;
    code: string;
    description?: string;
    level?: "beginner" | "intermediate" | "advanced";
    masteryThreshold?: number;
    goalConceptId?: string | null;
    batchIds?: string[];
    moduleIds?: string[];
  },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  const [existing] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.instituteId, instituteId), eq(courses.code, input.code)))
    .limit(1);

  if (existing) throw AppError.conflict(`A course with code "${input.code}" already exists.`);

  const [created] = await db
    .insert(courses)
    .values({
      instituteId,
      name: input.name,
      code: input.code,
      description: input.description ?? "",
      level: input.level ?? "intermediate",
      masteryThreshold: input.masteryThreshold ?? 0.8,
      goalConceptId: input.goalConceptId ?? null,
      createdBy: actor.id,
    })
    .returning();

  if (!created) throw AppError.internal("Failed to create course");

  // Link initial modules
  if (input.moduleIds && input.moduleIds.length > 0) {
    for (let i = 0; i < input.moduleIds.length; i++) {
      await db.insert(courseModules).values({
        courseId: created.id,
        moduleId: input.moduleIds[i]!,
        orderIndex: i,
        instituteId,
      }).onConflictDoNothing();
    }
  }

  // Link initial batches
  if (input.batchIds && input.batchIds.length > 0) {
    for (const batchId of input.batchIds) {
      await db.insert(courseBatches).values({
        courseId: created.id,
        batchId,
        instituteId,
      }).onConflictDoNothing();
    }
  }

  return created;
}

/**
 * Updates course metadata or status.
 */
export async function updateCourse(
  actor: Actor,
  courseId: string,
  input: {
    name?: string;
    code?: string;
    description?: string;
    level?: "beginner" | "intermediate" | "advanced";
    status?: "draft" | "published" | "archived";
    masteryThreshold?: number;
    goalConceptId?: string | null;
  },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  const [course] = await db
    .select({ id: courses.id, status: courses.status })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.instituteId, instituteId)))
    .limit(1);

  if (!course) throw AppError.notFound("Course not found");

  if (input.code) {
    const [dup] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.instituteId, instituteId), eq(courses.code, input.code)))
      .limit(1);
    if (dup && dup.id !== courseId) {
      throw AppError.conflict(`A course with code "${input.code}" already exists.`);
    }
  }

  const [updated] = await db
    .update(courses)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.masteryThreshold !== undefined ? { masteryThreshold: input.masteryThreshold } : {}),
      ...(input.goalConceptId !== undefined ? { goalConceptId: input.goalConceptId } : {}),
    })
    .where(eq(courses.id, courseId))
    .returning();

  return updated;
}

/**
 * Links a module to a course or creates a new module.
 */
export async function addModuleToCourse(
  actor: Actor,
  courseId: string,
  input: {
    moduleId?: string;
    name?: string;
    masteryThreshold?: number;
    goalConceptId?: string;
    orderIndex?: number;
  },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  let targetModuleId = input.moduleId;

  if (!targetModuleId) {
    if (!input.name) throw AppError.badRequest("Module name is required to create a new module");
    // Ensure goal concept exists or pick first concept
    let goalId = input.goalConceptId;
    if (!goalId) {
      const [firstConcept] = await db
        .select({ id: concepts.id })
        .from(concepts)
        .where(eq(concepts.instituteId, instituteId))
        .limit(1);
      if (!firstConcept) throw AppError.badRequest("Create at least one concept before creating a module");
      goalId = firstConcept.id;
    }

    const [createdModule] = await db
      .insert(modules)
      .values({
        instituteId,
        name: input.name,
        goalConceptId: goalId,
        masteryThreshold: input.masteryThreshold ?? 0.8,
      })
      .returning();

    if (!createdModule) throw AppError.internal("Failed to create module");
    targetModuleId = createdModule.id;
  }

  // Count existing modules in course for orderIndex
  const existingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(courseModules)
    .where(eq(courseModules.courseId, courseId));

  const nextOrder = input.orderIndex ?? (Number(existingCount[0]?.count ?? 0));

  await db
    .insert(courseModules)
    .values({
      courseId,
      moduleId: targetModuleId,
      orderIndex: nextOrder,
      instituteId,
    })
    .onConflictDoNothing();

  return { success: true, moduleId: targetModuleId };
}

/**
 * Unlinks a module from a course.
 */
export async function removeModuleFromCourse(actor: Actor, courseId: string, moduleId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  await db
    .delete(courseModules)
    .where(
      and(
        eq(courseModules.courseId, courseId),
        eq(courseModules.moduleId, moduleId),
        eq(courseModules.instituteId, instituteId),
      ),
    );

  return { success: true };
}

/**
 * Creates a section within a module.
 */
export async function createSection(
  actor: Actor,
  moduleId: string,
  input: { title: string; description?: string; orderIndex?: number },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  const [created] = await db
    .insert(sections)
    .values({
      moduleId,
      instituteId,
      title: input.title,
      description: input.description ?? "",
      orderIndex: input.orderIndex ?? 0,
    })
    .returning();

  return created;
}

/**
 * Updates a section.
 */
export async function updateSection(
  actor: Actor,
  sectionId: string,
  input: { title?: string; description?: string; orderIndex?: number },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  const [updated] = await db
    .update(sections)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
    })
    .where(and(eq(sections.id, sectionId), eq(sections.instituteId, instituteId)))
    .returning();

  return updated;
}

/**
 * Deletes a section.
 */
export async function deleteSection(actor: Actor, sectionId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  await db
    .delete(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.instituteId, instituteId)));

  return { success: true };
}

/**
 * Maps a concept to a section.
 */
export async function addConceptToSection(
  actor: Actor,
  sectionId: string,
  conceptId: string,
  orderIndex: number = 0,
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  const [section] = await db
    .select({ id: sections.id, moduleId: sections.moduleId })
    .from(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.instituteId, instituteId)))
    .limit(1);

  if (!section) throw AppError.notFound("Section not found");

  await db
    .insert(sectionConcepts)
    .values({
      sectionId,
      conceptId,
      orderIndex,
      instituteId,
    })
    .onConflictDoNothing();

  // Also ensure concept is linked to module
  await db
    .insert(moduleConcepts)
    .values({
      moduleId: section.moduleId,
      conceptId,
      instituteId,
    })
    .onConflictDoNothing();

  return { success: true };
}

/**
 * Removes a concept from a section.
 */
export async function removeConceptFromSection(actor: Actor, sectionId: string, conceptId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  await db
    .delete(sectionConcepts)
    .where(
      and(
        eq(sectionConcepts.sectionId, sectionId),
        eq(sectionConcepts.conceptId, conceptId),
        eq(sectionConcepts.instituteId, instituteId),
      ),
    );

  return { success: true };
}

/**
 * Updates batch assignments for a course.
 */
export async function assignCourseBatches(
  actor: Actor,
  courseId: string,
  batchIds: string[],
  deadline?: Date | null,
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  // Clear current batch assignments
  await db
    .delete(courseBatches)
    .where(and(eq(courseBatches.courseId, courseId), eq(courseBatches.instituteId, instituteId)));

  // Re-insert new assignments
  if (batchIds.length > 0) {
    for (const batchId of batchIds) {
      await db.insert(courseBatches).values({
        courseId,
        batchId,
        instituteId,
        deadline: deadline ?? null,
      });
    }
  }

  return { success: true, assignedCount: batchIds.length };
}

/**
 * Validates and publishes a course.
 */
export async function publishCourse(actor: Actor, courseId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const detail = await getCourseDetail(actor, courseId);

  if (!detail.validation.canPublish) {
    throw AppError.badRequest(
      `Cannot publish course: ${detail.validation.issues.join(". ")}`,
    );
  }

  const [published] = await db
    .update(courses)
    .set({ status: "published" })
    .where(eq(courses.id, courseId))
    .returning();

  return published;
}
