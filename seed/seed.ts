import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { batchMembers, batchTrainers, batches, concepts, consents, courseBatches, courseModules, courses, events, institutes, learningSessions, masteryState, modules, questions, sectionConcepts, sections, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { parseRole } from "@/lib/auth-fields";
import type { Actor } from "@/lib/auth/actor";
import { addPrerequisite, createConcept, createModule } from "@/lib/services/concepts";
import { planEventAppend } from "@/lib/engine/event-chain";
import { persistSessionSignals } from "@/lib/services/integrity";
import { nextQuestion } from "@/lib/services/assessment";
import { createQuestion } from "@/lib/services/questions";
import {
  ASYNC_CONCEPTS,
  ASYNC_EDGES,
  DEMO_BATCH,
  DEMO_CONCEPTS,
  DEMO_EDGES,
  DEMO_INSTITUTE,
  DEMO_PASSWORD,
  DEMO_QUESTIONS,
  DEMO_USERS,
  DEVOPS_CONCEPTS,
  DEVOPS_EDGES,
} from "./catalog";

async function ensureInstitute(): Promise<string> {
  const [existing] = await db
    .select({ id: institutes.id })
    .from(institutes)
    .where(eq(institutes.name, DEMO_INSTITUTE))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(institutes)
    .values({ name: DEMO_INSTITUTE })
    .returning({ id: institutes.id });
  if (!created) throw new Error("Could not create the institute");
  return created.id;
}

async function ensureUser(input: {
  email: string;
  name: string;
  role: "student" | "trainer" | "admin";
  instituteId: string;
}): Promise<string> {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);

  let userId = existing?.id;
  if (!userId) {
    const created = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: DEMO_PASSWORD,
        name: input.name,
      },
    });
    userId = created.user.id;
  }

  await db
    .update(user)
    .set({
      role: input.role,
      instituteId: input.instituteId,
      emailVerified: true,
      name: input.name,
    })
    .where(eq(user.id, userId));

  return userId;
}

async function verifyLogin(email: string, expectedRole: string) {
  const result = await auth.api.signInEmail({
    body: { email, password: DEMO_PASSWORD },
  });
  if (!result.user) throw new Error(`Login failed for ${email}`);
  const [row] = await db
    .select({ role: user.role, instituteId: user.instituteId })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!row || parseRole(row.role) !== expectedRole || !row.instituteId) {
    throw new Error(`Login for ${email} did not load the expected role`);
  }
  console.log(`login ok  ${email}  ${row.role}`);
}

async function main() {
  const instituteId = await ensureInstitute();
  const ids = new Map<string, string>();

  for (const account of DEMO_USERS) {
    const id = await ensureUser({ ...account, instituteId });
    ids.set(account.email, id);
  }

  const trainerId = ids.get("trainer@techsummit.example");
  if (!trainerId) throw new Error("Trainer was not created");
  const trainer: Actor = {
    id: trainerId,
    name: "Taylor Trainer",
    email: "trainer@techsummit.example",
    role: "trainer",
    instituteId,
  };

  const [existingBatch] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.instituteId, instituteId), eq(batches.name, DEMO_BATCH)))
    .limit(1);
  const batchId =
    existingBatch?.id ??
    (
      await db
        .insert(batches)
        .values({ instituteId, name: DEMO_BATCH })
        .returning({ id: batches.id })
    )[0]?.id;
  if (!batchId) throw new Error("Could not create the batch");

  await db
    .insert(batchTrainers)
    .values({ batchId, trainerId, instituteId })
    .onConflictDoNothing();

  for (const email of ["ada@techsummit.example", "ben@techsummit.example", "cara@techsummit.example"]) {
    const studentId = ids.get(email);
    if (!studentId) throw new Error(`Missing student ${email}`);
    await db.insert(batchMembers).values({ batchId, studentId, instituteId }).onConflictDoNothing();
  }

  const conceptIds = new Map<string, string>();
  for (const concept of DEMO_CONCEPTS) {
    try {
      const created = await createConcept(trainer, {
        name: concept.name,
        description: concept.description,
      });
      conceptIds.set(concept.key, created.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already exists")) throw error;
      const [found] = await db
        .select({ id: concepts.id })
        .from(concepts)
        .where(and(eq(concepts.instituteId, instituteId), eq(concepts.name, concept.name)))
        .limit(1);
      if (!found) throw error;
      conceptIds.set(concept.key, found.id);
    }
  }

  for (const edge of DEMO_EDGES) {
    const conceptId = conceptIds.get(edge.concept);
    const requiresId = conceptIds.get(edge.requires);
    if (!conceptId || !requiresId) throw new Error("Concept ids missing for an edge");
    try {
      await addPrerequisite(trainer, conceptId, requiresId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already a prerequisite")) throw error;
    }
  }

  const goalId = conceptIds.get("di");
  if (!goalId) throw new Error("Goal concept missing");
  const [existingModule] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.instituteId, instituteId), eq(modules.name, "TypeScript OOP")))
    .limit(1);
  let createdModuleId = existingModule?.id;
  if (!existingModule) {
    const mod = await createModule(trainer, {
      name: "TypeScript OOP",
      goalConceptId: goalId,
      masteryThreshold: 0.8,
      conceptIds: DEMO_CONCEPTS.map((concept) => {
        const id = conceptIds.get(concept.key);
        if (!id) throw new Error("Concept id missing");
        return id;
      }),
    });
    createdModuleId = mod.id;
  }

  // --- SEED 3 MOCK COURSES FOR COURSE MANAGEMENT ---

  // 1. Course 1: TS-201 (Published)
  let [course1] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.instituteId, instituteId), eq(courses.code, "TS-201")))
    .limit(1);

  if (!course1) {
    const [inserted] = await db
      .insert(courses)
      .values({
        instituteId,
        name: "TypeScript OOP & Architecture",
        code: "TS-201",
        description: "Comprehensive mastery of type-safe object design, design patterns, and dependency injection.",
        level: "intermediate",
        status: "published",
        masteryThreshold: 0.8,
        goalConceptId: goalId,
        createdBy: trainer.id,
      })
      .returning();
    course1 = inserted;
  }

  if (course1 && createdModuleId) {
    await db
      .insert(courseModules)
      .values({ courseId: course1.id, moduleId: createdModuleId, orderIndex: 0, instituteId })
      .onConflictDoNothing();

    const [existingSec1] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.moduleId, createdModuleId), eq(sections.title, "Section 1: Type Fundamentals & Functions")))
      .limit(1);

    const sec1Id = existingSec1?.id ?? (await db.insert(sections).values({
      moduleId: createdModuleId,
      instituteId,
      title: "Section 1: Type Fundamentals & Functions",
      description: "Variable semantics, scopes, function parameters, and pure functions.",
      orderIndex: 0,
    }).returning({ id: sections.id }))[0]?.id;

    const [existingSec2] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.moduleId, createdModuleId), eq(sections.title, "Section 2: Object-Oriented Patterns & DI")))
      .limit(1);

    const sec2Id = existingSec2?.id ?? (await db.insert(sections).values({
      moduleId: createdModuleId,
      instituteId,
      title: "Section 2: Object-Oriented Patterns & DI",
      description: "Classes, specialization through inheritance, and dependency injection architectures.",
      orderIndex: 1,
    }).returning({ id: sections.id }))[0]?.id;

    const vId = conceptIds.get("variables");
    const fId = conceptIds.get("functions");
    const cId = conceptIds.get("classes");
    const iId = conceptIds.get("inheritance");
    const dId = conceptIds.get("di");

    if (sec1Id) {
      if (vId) await db.insert(sectionConcepts).values({ sectionId: sec1Id, conceptId: vId, orderIndex: 0, instituteId }).onConflictDoNothing();
      if (fId) await db.insert(sectionConcepts).values({ sectionId: sec1Id, conceptId: fId, orderIndex: 1, instituteId }).onConflictDoNothing();
    }
    if (sec2Id) {
      if (cId) await db.insert(sectionConcepts).values({ sectionId: sec2Id, conceptId: cId, orderIndex: 0, instituteId }).onConflictDoNothing();
      if (iId) await db.insert(sectionConcepts).values({ sectionId: sec2Id, conceptId: iId, orderIndex: 1, instituteId }).onConflictDoNothing();
      if (dId) await db.insert(sectionConcepts).values({ sectionId: sec2Id, conceptId: dId, orderIndex: 2, instituteId }).onConflictDoNothing();
    }

    await db.insert(courseBatches).values({
      courseId: course1.id,
      batchId,
      instituteId,
      deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    }).onConflictDoNothing();
  }

  // --- SEED DEVOPS CONCEPTS & PREREQUISITES FOR COURSE 2 ---
  const devopsConceptIds = new Map<string, string>();
  for (const concept of DEVOPS_CONCEPTS) {
    try {
      const created = await createConcept(trainer, {
        name: concept.name,
        description: concept.description,
      });
      devopsConceptIds.set(concept.key, created.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already exists")) throw error;
      const [found] = await db
        .select({ id: concepts.id })
        .from(concepts)
        .where(and(eq(concepts.instituteId, instituteId), eq(concepts.name, concept.name)))
        .limit(1);
      if (!found) throw error;
      devopsConceptIds.set(concept.key, found.id);
    }
  }

  for (const edge of DEVOPS_EDGES) {
    const cId = devopsConceptIds.get(edge.concept);
    const rId = devopsConceptIds.get(edge.requires);
    if (!cId || !rId) throw new Error("DevOps concept ids missing for an edge");
    try {
      await addPrerequisite(trainer, cId, rId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already a prerequisite")) throw error;
    }
  }

  const devopsGoalId = devopsConceptIds.get("k8s-rollouts");
  if (!devopsGoalId) throw new Error("DevOps goal concept missing");

  // --- SEED ASYNC CONCEPTS & PREREQUISITES FOR COURSE 3 ---
  const asyncConceptIds = new Map<string, string>();
  for (const concept of ASYNC_CONCEPTS) {
    try {
      const created = await createConcept(trainer, {
        name: concept.name,
        description: concept.description,
      });
      asyncConceptIds.set(concept.key, created.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already exists")) throw error;
      const [found] = await db
        .select({ id: concepts.id })
        .from(concepts)
        .where(and(eq(concepts.instituteId, instituteId), eq(concepts.name, concept.name)))
        .limit(1);
      if (!found) throw error;
      asyncConceptIds.set(concept.key, found.id);
    }
  }

  for (const edge of ASYNC_EDGES) {
    const cId = asyncConceptIds.get(edge.concept);
    const rId = asyncConceptIds.get(edge.requires);
    if (!cId || !rId) throw new Error("Async concept ids missing for an edge");
    try {
      await addPrerequisite(trainer, cId, rId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already a prerequisite")) throw error;
    }
  }

  const asyncGoalId = asyncConceptIds.get("stream-backpressure");
  if (!asyncGoalId) throw new Error("Async goal concept missing");

  // 2. Course 2: OPS-301 (Published)
  let [course2] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.instituteId, instituteId), eq(courses.code, "OPS-301")))
    .limit(1);

  if (!course2) {
    const [inserted] = await db
      .insert(courses)
      .values({
        instituteId,
        name: "Cloud Native DevOps & Containerization",
        code: "OPS-301",
        description: "Production Linux systems, Docker multi-stage builds, and Kubernetes orchestration with zero-downtime rolling updates.",
        level: "advanced",
        status: "published",
        masteryThreshold: 0.85,
        goalConceptId: devopsGoalId,
        createdBy: trainer.id,
      })
      .returning();
    course2 = inserted;
  } else {
    await db.update(courses).set({ status: "published", goalConceptId: devopsGoalId }).where(eq(courses.id, course2.id));
  }

  // Ensure Module for Course 2
  const [existingDevOpsMod] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.instituteId, instituteId), eq(modules.name, "Container Systems & DevOps")))
    .limit(1);

  let devopsModId = existingDevOpsMod?.id;
  if (!existingDevOpsMod) {
    const mod = await createModule(trainer, {
      name: "Container Systems & DevOps",
      goalConceptId: devopsGoalId,
      masteryThreshold: 0.85,
      conceptIds: Array.from(devopsConceptIds.values()),
    });
    devopsModId = mod.id;
  }

  if (course2 && devopsModId) {
    await db.insert(courseModules).values({ courseId: course2.id, moduleId: devopsModId, orderIndex: 0, instituteId }).onConflictDoNothing();

    const [existingDevSec1] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.moduleId, devopsModId), eq(sections.title, "Section 1: Linux Namespaces & POSIX Isolation")))
      .limit(1);

    const devSec1Id = existingDevSec1?.id ?? (await db.insert(sections).values({
      moduleId: devopsModId,
      instituteId,
      title: "Section 1: Linux Namespaces & POSIX Isolation",
      description: "Kernel namespaces, cgroups resource controls, and chroot jail isolation.",
      orderIndex: 0,
    }).returning({ id: sections.id }))[0]?.id;

    const [existingDevSec2] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.moduleId, devopsModId), eq(sections.title, "Section 2: Docker Engine & BuildKit Pipelines")))
      .limit(1);

    const devSec2Id = existingDevSec2?.id ?? (await db.insert(sections).values({
      moduleId: devopsModId,
      instituteId,
      title: "Section 2: Docker Engine & BuildKit Pipelines",
      description: "Multi-stage Dockerfiles, caching strategies, and virtual bridge networks.",
      orderIndex: 1,
    }).returning({ id: sections.id }))[0]?.id;

    const [existingDevSec3] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.moduleId, devopsModId), eq(sections.title, "Section 3: Kubernetes Orchestration & Rollouts")))
      .limit(1);

    const devSec3Id = existingDevSec3?.id ?? (await db.insert(sections).values({
      moduleId: devopsModId,
      instituteId,
      title: "Section 3: Kubernetes Orchestration & Rollouts",
      description: "Declarative pod specs, health checks, and zero-downtime rolling release strategies.",
      orderIndex: 2,
    }).returning({ id: sections.id }))[0]?.id;

    const nsId = devopsConceptIds.get("namespaces");
    const chrId = devopsConceptIds.get("chroot");
    const dckId = devopsConceptIds.get("docker-build");
    const netId = devopsConceptIds.get("container-net");
    const podId = devopsConceptIds.get("k8s-pods");
    const rollId = devopsConceptIds.get("k8s-rollouts");

    // Clean up any stale courseModules or sectionConcepts for course2
    await db.delete(courseModules).where(and(eq(courseModules.courseId, course2.id), ne(courseModules.moduleId, devopsModId)));
    if (devSec1Id) await db.delete(sectionConcepts).where(eq(sectionConcepts.sectionId, devSec1Id));
    if (devSec2Id) await db.delete(sectionConcepts).where(eq(sectionConcepts.sectionId, devSec2Id));
    if (devSec3Id) await db.delete(sectionConcepts).where(eq(sectionConcepts.sectionId, devSec3Id));

    if (devSec1Id) {
      if (nsId) await db.insert(sectionConcepts).values({ sectionId: devSec1Id, conceptId: nsId, orderIndex: 0, instituteId }).onConflictDoNothing();
      if (chrId) await db.insert(sectionConcepts).values({ sectionId: devSec1Id, conceptId: chrId, orderIndex: 1, instituteId }).onConflictDoNothing();
    }
    if (devSec2Id) {
      if (dckId) await db.insert(sectionConcepts).values({ sectionId: devSec2Id, conceptId: dckId, orderIndex: 0, instituteId }).onConflictDoNothing();
      if (netId) await db.insert(sectionConcepts).values({ sectionId: devSec2Id, conceptId: netId, orderIndex: 1, instituteId }).onConflictDoNothing();
    }
    if (devSec3Id) {
      if (podId) await db.insert(sectionConcepts).values({ sectionId: devSec3Id, conceptId: podId, orderIndex: 0, instituteId }).onConflictDoNothing();
      if (rollId) await db.insert(sectionConcepts).values({ sectionId: devSec3Id, conceptId: rollId, orderIndex: 1, instituteId }).onConflictDoNothing();
    }

    await db.insert(courseBatches).values({
      courseId: course2.id,
      batchId,
      instituteId,
      deadline: new Date(Date.now() + 45 * 24 * 3600 * 1000),
    }).onConflictDoNothing();
  }

  // 3. Course 3: SYS-101 (Draft)
  let [course3] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.instituteId, instituteId), eq(courses.code, "SYS-101")))
    .limit(1);

  if (!course3) {
    const [inserted] = await db
      .insert(courses)
      .values({
        instituteId,
        name: "Modern Full-Stack Systems & Async Runtimes",
        code: "SYS-101",
        description: "Foundations of JavaScript/TypeScript asynchronous event loops, microtasks, streams, and resilient client-server protocols.",
        level: "beginner",
        status: "draft",
        masteryThreshold: 0.75,
        goalConceptId: asyncGoalId,
        createdBy: trainer.id,
      })
      .returning();
    course3 = inserted;
  } else {
    await db.update(courses).set({ goalConceptId: asyncGoalId }).where(eq(courses.id, course3.id));
  }

  // Ensure Module for Course 3
  const [existingAsyncMod] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.instituteId, instituteId), eq(modules.name, "Async Event Loop & Concurrency")))
    .limit(1);

  let asyncModId = existingAsyncMod?.id;
  if (!existingAsyncMod) {
    const mod = await createModule(trainer, {
      name: "Async Event Loop & Concurrency",
      goalConceptId: asyncGoalId,
      masteryThreshold: 0.75,
      conceptIds: Array.from(asyncConceptIds.values()),
    });
    asyncModId = mod.id;
  }

  if (course3 && asyncModId) {
    await db.delete(courseModules).where(and(eq(courseModules.courseId, course3.id), ne(courseModules.moduleId, asyncModId)));
    await db.insert(courseModules).values({ courseId: course3.id, moduleId: asyncModId, orderIndex: 0, instituteId }).onConflictDoNothing();

    const [existingAsyncSec1] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.moduleId, asyncModId), eq(sections.title, "Section 1: Microtasks & Promise Architecture")))
      .limit(1);

    const asyncSec1Id = existingAsyncSec1?.id ?? (await db.insert(sections).values({
      moduleId: asyncModId,
      instituteId,
      title: "Section 1: Microtasks & Promise Architecture",
      description: "Call stack execution, web APIs, queue prioritization, and Promise lifecycle.",
      orderIndex: 0,
    }).returning({ id: sections.id }))[0]?.id;

    const [existingAsyncSec2] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.moduleId, asyncModId), eq(sections.title, "Section 2: Async Iteration & Stream Pipelines")))
      .limit(1);

    const asyncSec2Id = existingAsyncSec2?.id ?? (await db.insert(sections).values({
      moduleId: asyncModId,
      instituteId,
      title: "Section 2: Async Iteration & Stream Pipelines",
      description: "Async generators, stream backpressure handling, and Node.js transform pipelines.",
      orderIndex: 1,
    }).returning({ id: sections.id }))[0]?.id;

    const loopId = asyncConceptIds.get("event-loop");
    const promId = asyncConceptIds.get("promises");
    const emitId = asyncConceptIds.get("event-emitters");
    const iterId = asyncConceptIds.get("async-iterators");
    const strmId = asyncConceptIds.get("node-streams");
    const backId = asyncConceptIds.get("stream-backpressure");

    if (asyncSec1Id) await db.delete(sectionConcepts).where(eq(sectionConcepts.sectionId, asyncSec1Id));
    if (asyncSec2Id) await db.delete(sectionConcepts).where(eq(sectionConcepts.sectionId, asyncSec2Id));

    if (asyncSec1Id) {
      if (loopId) await db.insert(sectionConcepts).values({ sectionId: asyncSec1Id, conceptId: loopId, orderIndex: 0, instituteId }).onConflictDoNothing();
      if (promId) await db.insert(sectionConcepts).values({ sectionId: asyncSec1Id, conceptId: promId, orderIndex: 1, instituteId }).onConflictDoNothing();
      if (emitId) await db.insert(sectionConcepts).values({ sectionId: asyncSec1Id, conceptId: emitId, orderIndex: 2, instituteId }).onConflictDoNothing();
    }
    if (asyncSec2Id) {
      if (iterId) await db.insert(sectionConcepts).values({ sectionId: asyncSec2Id, conceptId: iterId, orderIndex: 0, instituteId }).onConflictDoNothing();
      if (strmId) await db.insert(sectionConcepts).values({ sectionId: asyncSec2Id, conceptId: strmId, orderIndex: 1, instituteId }).onConflictDoNothing();
      if (backId) await db.insert(sectionConcepts).values({ sectionId: asyncSec2Id, conceptId: backId, orderIndex: 2, instituteId }).onConflictDoNothing();
    }
  }

  for (const question of DEMO_QUESTIONS) {
    const [existing] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.instituteId, instituteId), eq(questions.statement, question.statement)))
      .limit(1);
    if (existing) continue;
    const conceptId = conceptIds.get(question.concept);
    if (!conceptId) throw new Error(`Missing concept ${question.concept}`);
    await createQuestion(trainer, {
      statement: question.statement,
      difficulty: question.difficulty,
      languages: ["javascript"],
      starterCode: { javascript: question.starter },
      conceptIds: [conceptId],
      status: "published",
      tests: [
        { visibility: "visible", ...question.visible },
        { visibility: "hidden", ...question.hidden },
      ],
    });
  }

  const adaId = ids.get("ada@techsummit.example");
  const benId = ids.get("ben@techsummit.example");
  const variablesId = conceptIds.get("variables");
  const functionsId = conceptIds.get("functions");
  const classesId = conceptIds.get("classes");
  if (!adaId || !benId || !variablesId || !functionsId || !classesId) {
    throw new Error("Demo students or concepts were not created");
  }
  const masteryRows = [
    { studentId: adaId, conceptId: variablesId, pKnow: 0.9 },
    { studentId: adaId, conceptId: functionsId, pKnow: 0.3 },
    { studentId: benId, conceptId: variablesId, pKnow: 0.95 },
    { studentId: benId, conceptId: functionsId, pKnow: 0.9 },
    { studentId: benId, conceptId: classesId, pKnow: 0.35 },
  ];
  for (const row of masteryRows) {
    await db
      .insert(masteryState)
      .values({ ...row, instituteId })
      .onConflictDoUpdate({
        target: [masteryState.studentId, masteryState.conceptId],
        set: { pKnow: row.pKnow, updatedAt: new Date() },
      });
  }

  const adaRoute = await nextQuestion({
    id: adaId,
    name: "Ada Student",
    email: "ada@techsummit.example",
    role: "student",
    instituteId,
  });
  const benRoute = await nextQuestion({
    id: benId,
    name: "Ben Student",
    email: "ben@techsummit.example",
    role: "student",
    instituteId,
  });
  console.log(`route ada  ${adaRoute.decision.reason}`);
  console.log(`route ben  ${benRoute.decision.reason}`);

  const [replayQuestion] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.instituteId, instituteId))
    .limit(1);
  if (replayQuestion) {
    await replaceReplaySession({
      sessionId: "demo-replay-valid",
      instituteId,
      studentId: adaId,
      questionId: replayQuestion.id,
      events: validReplayEvents(),
    });
    await replaceReplaySession({
      sessionId: "demo-replay-incomplete",
      instituteId,
      studentId: adaId,
      questionId: replayQuestion.id,
      events: incompleteReplayEvents(),
    });
    console.log("replay    /replay/demo-replay-valid");
    console.log("replay    /replay/demo-replay-incomplete");
    await replaceReviewSession({
      sessionId: "demo-review-paste",
      instituteId,
      studentId: adaId,
      questionId: replayQuestion.id,
    });
    console.log("review    /review");
    console.log("review    /replay/demo-review-paste");
  }

  for (const account of DEMO_USERS) {
    await verifyLogin(account.email, account.role);
  }

  console.log(`institute ${DEMO_INSTITUTE}`);
  console.log(`password  ${DEMO_PASSWORD}`);
  console.log(`questions ${DEMO_QUESTIONS.length}`);
}

function validReplayEvents() {
  const baseline = "function total(n) {\n  return ";
  const withDigit = `${baseline}n`;
  return [
    { seq: 1, t: 0, type: "session_start", payload: { mode: "practice", baseline } },
    { seq: 2, t: 450, type: "insert", payload: editorInsert(baseline.length, "n") },
    { seq: 3, t: 1100, type: "insert", payload: editorInsert(withDigit.length, " + 1;\n}") },
    { seq: 4, t: 1800, type: "run", payload: { language: "javascript" } },
    { seq: 5, t: 1900, type: "run_result", payload: { outcomes: ["ok"] } },
    { seq: 6, t: 2600, type: "submit", payload: { language: "javascript" } },
    { seq: 7, t: 2700, type: "submit_result", payload: { passed: 1, total: 2, categories: ["pass", "pass"] } },
  ];
}

function incompleteReplayEvents() {
  const baseline = "let value = ";
  return [
    { seq: 1, t: 0, type: "session_start", payload: { mode: "practice", baseline } },
    { seq: 2, t: 300, type: "insert", payload: editorInsert(baseline.length, "1") },
    { seq: 3, t: 700, type: "insert", payload: { length: 8 } },
    { seq: 5, t: 1400, type: "insert", payload: editorInsert(baseline.length + 1, ";") },
  ];
}

function editorInsert(at: number, text: string) {
  return {
    schemaVersion: 2,
    range: { start: at, end: at },
    text,
    removed: "",
    length: text.length,
    removedLength: 0,
  };
}

async function replaceReviewSession(input: {
  sessionId: string;
  instituteId: string;
  studentId: string;
  questionId: string;
}) {
  await db.delete(learningSessions).where(eq(learningSessions.id, input.sessionId));
  await db.delete(consents).where(eq(consents.id, "demo-review-consent"));
  await db.insert(consents).values({
    id: "demo-review-consent",
    instituteId: input.instituteId,
    studentId: input.studentId,
    policyVersion: "demo-review",
  });
  const pasted = "n".repeat(180);
  await replaceReplaySession({
    sessionId: input.sessionId,
    instituteId: input.instituteId,
    studentId: input.studentId,
    questionId: input.questionId,
    mode: "graded",
    consentId: "demo-review-consent",
    events: [
      { seq: 1, t: 0, type: "session_start", payload: { mode: "graded", baseline: "" } },
      { seq: 2, t: 5000, type: "paste", payload: editorInsert(0, pasted) },
      { seq: 3, t: 8000, type: "submit", payload: { language: "javascript" } },
    ],
  });
  await persistSessionSignals(input.sessionId);
}

async function replaceReplaySession(input: {
  sessionId: string;
  instituteId: string;
  studentId: string;
  questionId: string;
  mode?: "practice" | "graded";
  consentId?: string;
  events: { seq: number; t: number; type: string; payload: Record<string, unknown> }[];
}) {
  await db.delete(events).where(eq(events.sessionId, input.sessionId));
  await db.delete(learningSessions).where(eq(learningSessions.id, input.sessionId));
  await db.insert(learningSessions).values({
    id: input.sessionId,
    instituteId: input.instituteId,
    studentId: input.studentId,
    questionId: input.questionId,
    mode: input.mode ?? "practice",
    consentId: input.consentId,
  });
  const planned = planEventAppend([], input.events);
  if (planned.length === 0) return;
  await db.insert(events).values(
    planned.map((event) => ({
      sessionId: input.sessionId,
      instituteId: input.instituteId,
      seq: event.seq,
      t: event.t,
      type: event.type,
      payloadJson: (event.payload ?? {}) as Record<string, unknown>,
      prevHash: event.prevHash,
      schemaVersion: event.schemaVersion,
      chainIndex: event.chainIndex,
      receivedAt: new Date(),
    })),
  );
}

main()
  .then(async () => {
    const { closeDatabase } = await import("@/db");
    await closeDatabase();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    const { closeDatabase } = await import("@/db");
    await closeDatabase();
    process.exit(1);
  });
