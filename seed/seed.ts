import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { batchMembers, batchTrainers, batches, concepts, consents, events, institutes, learningSessions, masteryState, modules, questions, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { parseRole } from "@/lib/auth-fields";
import type { Actor } from "@/lib/auth/actor";
import { addPrerequisite, createConcept, createModule } from "@/lib/services/concepts";
import { planEventAppend } from "@/lib/engine/event-chain";
import { persistSessionSignals } from "@/lib/services/integrity";
import { nextQuestion } from "@/lib/services/assessment";
import { createQuestion } from "@/lib/services/questions";
import {
  DEMO_BATCH,
  DEMO_CONCEPTS,
  DEMO_EDGES,
  DEMO_INSTITUTE,
  DEMO_PASSWORD,
  DEMO_QUESTIONS,
  DEMO_USERS,
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
  if (!existingModule) {
    await createModule(trainer, {
      name: "TypeScript OOP",
      goalConceptId: goalId,
      masteryThreshold: 0.8,
      conceptIds: DEMO_CONCEPTS.map((concept) => {
        const id = conceptIds.get(concept.key);
        if (!id) throw new Error("Concept id missing");
        return id;
      }),
    });
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
