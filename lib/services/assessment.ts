import { and, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";

import { db } from "@/db";
import {
  attempts,
  concepts,
  consents,
  institutes,
  learningSessions,
  masteryState,
  masteryUpdates,
  moduleConcepts,
  modules,
  prerequisites,
  questionConcepts,
  questions,
  routingDecisions,
  tests,
} from "@/db/schema";
import type { SubmissionLanguage } from "@/db/schema";
import { submissionLanguages } from "@/db/schema";
import { DEFAULT_BKT_PARAMS, attemptIsCorrect, bktUpdate } from "@/lib/engine/bkt";
import { toHiddenResults, toVisibleResults } from "@/lib/engine/attempt-result";
import { toPublicQuestion, type PublicQuestion } from "@/lib/engine/public-question";
import { selectNextQuestion, type SelectorDecision } from "@/lib/engine/selector";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/auth/actor";
import { RateLimitError, RunQueue } from "@/sandbox/queue";
import { gradeOutput } from "@/sandbox/grade";
import { DockerSandboxRunner } from "@/sandbox/docker-runner";
import type { SandboxRunner } from "@/sandbox/types";
import { prepareExecutionCode } from "@/lib/engine/harness";

const PASS_THRESHOLD = 1;

export type AssessmentDeps = {
  runner: SandboxRunner;
  queue: RunQueue;
};

const defaultDeps: AssessmentDeps = {
  runner: new DockerSandboxRunner(),
  queue: new RunQueue({ concurrency: 2, perStudentPerMinute: 10 }),
};

function consentVersion(consentText: string): string {
  return createHash("sha256").update(consentText).digest("hex").slice(0, 16);
}

function requireStudent(actor: Actor): string {
  if (actor.role !== "student") throw AppError.forbidden("This action is for students");
  if (!actor.instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  return actor.instituteId;
}

export async function getConsent(actor: Actor) {
  const instituteId = requireStudent(actor);
  const policy = await loadPolicy(instituteId);
  const version = consentVersion(policy.consentText);
  const [existing] = await db
    .select({ id: consents.id, acceptedAt: consents.acceptedAt })
    .from(consents)
    .where(
      and(eq(consents.studentId, actor.id), eq(consents.instituteId, instituteId), eq(consents.policyVersion, version)),
    )
    .limit(1);
  return {
    policyVersion: version,
    consentText: policy.consentText,
    accepted: Boolean(existing),
    consentId: existing?.id ?? null,
  };
}

export async function acceptConsent(actor: Actor) {
  const current = await getConsent(actor);
  if (current.consentId) return current;
  const instituteId = requireStudent(actor);
  const [created] = await db
    .insert(consents)
    .values({
      instituteId,
      studentId: actor.id,
      policyVersion: current.policyVersion,
    })
    .returning({ id: consents.id });
  return { ...current, accepted: true, consentId: created?.id ?? null };
}

export async function listLearningModules(actor: Actor) {
  const instituteId = requireStudent(actor);
  return db
    .select({
      id: modules.id,
      name: modules.name,
      goalConceptId: modules.goalConceptId,
      masteryThreshold: modules.masteryThreshold,
    })
    .from(modules)
    .where(eq(modules.instituteId, instituteId));
}

export async function nextQuestion(actor: Actor, moduleId?: string) {
  const instituteId = requireStudent(actor);
  const moduleRow = await loadModule(instituteId, moduleId);
  const decision = await routeStudent(actor.id, instituteId, moduleRow);
  await db.insert(routingDecisions).values({
    instituteId,
    studentId: actor.id,
    moduleId: moduleRow.id,
    chosenConceptId: decision.conceptId,
    chosenQuestionId: decision.questionId,
    reason: decision.reason,
    alternativesJson: decision.alternatives,
  });
  const question = decision.questionId ? await loadPublicQuestion(instituteId, decision.questionId) : null;
  return {
    moduleId: moduleRow.id,
    moduleName: moduleRow.name,
    threshold: moduleRow.masteryThreshold,
    decision: publicDecision(decision),
    question,
  };
}

export async function startSession(
  actor: Actor,
  input: { questionId: string; mode: "practice" | "graded" },
) {
  const instituteId = requireStudent(actor);
  const question = await loadPublicQuestion(instituteId, input.questionId);
  if (question.status !== "published") throw AppError.notFound("Question not found");

  let consentId: string | null = null;
  if (input.mode === "graded") {
    const consent = await getConsent(actor);
    if (!consent.consentId) {
      throw AppError.conflict("Record consent before starting a graded session.");
    }
    consentId = consent.consentId;
  }

  const [session] = await db
    .insert(learningSessions)
    .values({
      instituteId,
      studentId: actor.id,
      questionId: input.questionId,
      mode: input.mode,
      consentId,
    })
    .returning({ id: learningSessions.id, mode: learningSessions.mode });
  if (!session) throw AppError.internal("Could not start the session");

  return {
    id: session.id,
    mode: session.mode,
    recording: session.mode === "graded",
    question,
  };
}

export async function runSession(
  actor: Actor,
  sessionId: string,
  input: { language: SubmissionLanguage; code: string },
  deps: AssessmentDeps = defaultDeps,
) {
  const session = await ownedSession(actor, sessionId);
  const visible = await loadTests(session.instituteId, session.questionId, "visible");
  assertLanguage(session.languages, input.language);

  // Retrieve statement to prepare function block execution harness
  const [qRow] = await db
    .select({ statement: questions.statement })
    .from(questions)
    .where(eq(questions.id, session.questionId))
    .limit(1);

  const preparedCode = prepareExecutionCode(qRow?.statement ?? "", input.language, input.code);
  const graded = await executeTests(actor.id, { ...input, code: preparedCode }, visible, deps);
  const results = toVisibleResults(graded);
  const passed = results.filter((test) => test.passed).length;
  await db.insert(attempts).values({
    instituteId: session.instituteId,
    sessionId,
    kind: "run",
    language: input.language,
    code: input.code,
    resultJson: results,
    passRate: results.length === 0 ? 0 : passed / results.length,
    sandboxLog: results.map((test) => `${test.message}${test.stderr ? `\n${test.stderr}` : ""}`).join("\n"),
  });

  const firstCompileErr = results.find((t) => t.outcome === "compile_error" && t.stderr)?.stderr;
  const firstRuntimeErr = results.find((t) => t.outcome === "runtime_error" && t.stderr)?.stderr;

  return {
    tests: results,
    compilationError: firstCompileErr,
    runtimeError: firstRuntimeErr,
  };
}

export async function submitSession(
  actor: Actor,
  sessionId: string,
  input: { language: SubmissionLanguage; code: string },
  deps: AssessmentDeps = defaultDeps,
) {
  const session = await ownedSession(actor, sessionId);

  // Idempotency check: if session was already submitted, return existing attempt without re-applying mastery
  const [existingAttempt] = await db
    .select({
      id: attempts.id,
      resultJson: attempts.resultJson,
      passRate: attempts.passRate,
    })
    .from(attempts)
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.kind, "submit")))
    .limit(1);

  if (existingAttempt) {
    const existingSummary = existingAttempt.resultJson as ReturnType<typeof toHiddenResults>;
    const alreadyCorrect = attemptIsCorrect(existingAttempt.passRate ?? 0, PASS_THRESHOLD);
    return {
      ...existingSummary,
      correct: alreadyCorrect,
      mastery: [],
      attemptId: existingAttempt.id,
    };
  }

  const hidden = await loadTests(session.instituteId, session.questionId, "hidden");
  assertLanguage(session.languages, input.language);

  // Retrieve statement to prepare function block execution harness
  const [qRow] = await db
    .select({ statement: questions.statement })
    .from(questions)
    .where(eq(questions.id, session.questionId))
    .limit(1);

  const preparedCode = prepareExecutionCode(qRow?.statement ?? "", input.language, input.code);
  const graded = await executeTests(actor.id, { ...input, code: preparedCode }, hidden, deps);
  const summary = toHiddenResults(graded);
  const correct = attemptIsCorrect(summary.passRate, PASS_THRESHOLD);

  const [attempt] = await db
    .insert(attempts)
    .values({
      instituteId: session.instituteId,
      sessionId,
      kind: "submit",
      language: input.language,
      code: input.code,
      resultJson: summary,
      passRate: summary.passRate,
      sandboxLog: summary.tests.map((test) => `${test.category}: ${test.message}`).join("\n"),
    })
    .returning({ id: attempts.id });

  // Mark session as ended
  await db
    .update(learningSessions)
    .set({ endedAt: new Date() })
    .where(eq(learningSessions.id, sessionId));

  let mastery: { conceptId: string; before: number; after: number }[] = [];
  if (session.mode === "graded") {
    mastery = await applyMastery(actor.id, session.instituteId, session.questionId, correct);
    const { persistSessionSignals } = await import("@/lib/services/integrity");
    await persistSessionSignals(session.id);
  }

  return { ...summary, correct, mastery, attemptId: attempt?.id ?? null };
}


async function applyMastery(studentId: string, instituteId: string, questionId: string, correct: boolean) {
  const tagged = await db
    .select({
      conceptId: questionConcepts.conceptId,
      params: concepts.bktParamsJson,
    })
    .from(questionConcepts)
    .innerJoin(concepts, eq(concepts.id, questionConcepts.conceptId))
    .where(and(eq(questionConcepts.questionId, questionId), eq(questionConcepts.instituteId, instituteId)));

  const updates: { conceptId: string; before: number; after: number }[] = [];
  for (const tag of tagged) {
    const params = tag.params ?? DEFAULT_BKT_PARAMS;
    const [current] = await db
      .select({ pKnow: masteryState.pKnow })
      .from(masteryState)
      .where(and(eq(masteryState.studentId, studentId), eq(masteryState.conceptId, tag.conceptId)))
      .limit(1);
    const before = current?.pKnow ?? params.pInit;
    const after = bktUpdate(before, correct, params);
    await db
      .insert(masteryState)
      .values({
        studentId,
        conceptId: tag.conceptId,
        instituteId,
        pKnow: after,
      })
      .onConflictDoUpdate({
        target: [masteryState.studentId, masteryState.conceptId],
        set: { pKnow: after, updatedAt: new Date() },
      });
    await db.insert(masteryUpdates).values({
      instituteId,
      studentId,
      conceptId: tag.conceptId,
      before,
      after,
      causeType: "attempt",
    });
    updates.push({ conceptId: tag.conceptId, before, after });
  }
  return updates;
}

async function executeTests(
  studentId: string,
  input: { language: SubmissionLanguage; code: string },
  rows: { id: string; input: string; expectedOutput: string }[],
  deps: AssessmentDeps,
) {
  try {
    return await deps.queue.submit(studentId, async () => {
      const results = [];
      for (const row of rows) {
        const raw = await deps.runner.run(input.language, input.code, row.input);
        const graded = gradeOutput(raw, row.expectedOutput);
        results.push({ id: row.id, ...graded });
      }
      return results;
    });
  } catch (error) {
    if (error instanceof RateLimitError) throw AppError.tooManyRequests(error.message);
    throw error;
  }
}

async function ownedSession(actor: Actor, sessionId: string) {
  const instituteId = requireStudent(actor);
  const [session] = await db
    .select({
      id: learningSessions.id,
      studentId: learningSessions.studentId,
      instituteId: learningSessions.instituteId,
      questionId: learningSessions.questionId,
      mode: learningSessions.mode,
      languages: questions.languages,
    })
    .from(learningSessions)
    .innerJoin(questions, eq(questions.id, learningSessions.questionId))
    .where(eq(learningSessions.id, sessionId))
    .limit(1);
  if (!session || session.instituteId !== instituteId) throw AppError.notFound("Session not found");
  if (session.studentId !== actor.id) throw AppError.forbidden("You can only open your own session");
  return session;
}

async function loadPolicy(instituteId: string) {
  const [row] = await db
    .select({ policy: institutes.policyJson })
    .from(institutes)
    .where(eq(institutes.id, instituteId))
    .limit(1);
  if (!row) throw AppError.notFound("Institute not found");
  return row.policy;
}

async function loadModule(instituteId: string, moduleId?: string) {
  const rows = await db
    .select({
      id: modules.id,
      name: modules.name,
      goalConceptId: modules.goalConceptId,
      masteryThreshold: modules.masteryThreshold,
    })
    .from(modules)
    .where(
      moduleId
        ? and(eq(modules.instituteId, instituteId), eq(modules.id, moduleId))
        : eq(modules.instituteId, instituteId),
    )
    .limit(1);
  const moduleRow = rows[0];
  if (!moduleRow) throw AppError.notFound("Module not found");
  return moduleRow;
}

async function routeStudent(
  studentId: string,
  instituteId: string,
  moduleRow: { id: string; goalConceptId: string; masteryThreshold: number },
): Promise<SelectorDecision> {
  const conceptRows = await db
    .select({ id: concepts.id, name: concepts.name, params: concepts.bktParamsJson })
    .from(moduleConcepts)
    .innerJoin(concepts, eq(concepts.id, moduleConcepts.conceptId))
    .where(eq(moduleConcepts.moduleId, moduleRow.id));
  const conceptIds = conceptRows.map((concept) => concept.id);
  const edgeRows =
    conceptIds.length === 0
      ? []
      : await db
          .select({ conceptId: prerequisites.conceptId, requiresId: prerequisites.requiresId })
          .from(prerequisites)
          .where(
            and(
              eq(prerequisites.instituteId, instituteId),
              inArray(prerequisites.conceptId, conceptIds),
              inArray(prerequisites.requiresId, conceptIds),
            ),
          );
  const masteryRows =
    conceptIds.length === 0
      ? []
      : await db
          .select({ conceptId: masteryState.conceptId, pKnow: masteryState.pKnow })
          .from(masteryState)
          .where(and(eq(masteryState.studentId, studentId), inArray(masteryState.conceptId, conceptIds)));
  const questionRows =
    conceptIds.length === 0
      ? []
      : await db
          .select({ id: questions.id, conceptId: questionConcepts.conceptId, difficulty: questions.difficulty })
          .from(questionConcepts)
          .innerJoin(questions, eq(questions.id, questionConcepts.questionId))
          .where(
            and(
              eq(questions.instituteId, instituteId),
              eq(questions.status, "published"),
              inArray(questionConcepts.conceptId, conceptIds),
            ),
          );
  const attempted = await db
    .select({ questionId: learningSessions.questionId })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .where(and(eq(learningSessions.studentId, studentId), eq(attempts.kind, "submit")));

  return selectNextQuestion({
    goalId: moduleRow.goalConceptId,
    concepts: conceptRows,
    edges: edgeRows,
    mastery: Object.fromEntries(masteryRows.map((row) => [row.conceptId, row.pKnow])),
    threshold: moduleRow.masteryThreshold,
    questions: questionRows,
    attemptedQuestionIds: attempted.map((row) => row.questionId),
    params: conceptRows[0]?.params ?? DEFAULT_BKT_PARAMS,
  });
}

/** The same selector as practice, without writing a routing decision. */
export async function previewRoute(studentId: string, instituteId: string, moduleId?: string) {
  const moduleRow = await loadModule(instituteId, moduleId);
  const decision = await routeStudent(studentId, instituteId, moduleRow);
  return { module: moduleRow, decision };
}

async function loadPublicQuestion(instituteId: string, questionId: string): Promise<PublicQuestion> {
  const [question] = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      difficulty: questions.difficulty,
      languages: questions.languages,
      starterCode: questions.starterCodeJson,
      status: questions.status,
    })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.instituteId, instituteId)))
    .limit(1);
  if (!question) throw AppError.notFound("Question not found");
  const testRows = await db
    .select({
      id: tests.id,
      visibility: tests.visibility,
      input: tests.input,
      expectedOutput: tests.expectedOutput,
    })
    .from(tests)
    .where(eq(tests.questionId, questionId));
  const conceptRows = await db
    .select({ conceptId: questionConcepts.conceptId })
    .from(questionConcepts)
    .where(eq(questionConcepts.questionId, questionId));
  return toPublicQuestion(
    { ...question, starterCode: question.starterCode },
    testRows.map((test) => ({
      ...test,
      visibility: test.visibility === "hidden" ? "hidden" : "visible",
    })),
    conceptRows.map((row) => row.conceptId),
  );
}

async function loadTests(instituteId: string, questionId: string, visibility: "visible" | "hidden") {
  return db
    .select({ id: tests.id, input: tests.input, expectedOutput: tests.expectedOutput })
    .from(tests)
    .where(
      and(eq(tests.questionId, questionId), eq(tests.instituteId, instituteId), eq(tests.visibility, visibility)),
    );
}

function assertLanguage(allowed: SubmissionLanguage[], language: SubmissionLanguage) {
  if (!submissionLanguages.includes(language) || !allowed.includes(language)) {
    throw AppError.badRequest("That language is not enabled for this question");
  }
}

function publicDecision(decision: SelectorDecision) {
  return {
    conceptId: decision.conceptId,
    questionId: decision.questionId,
    reason: decision.reason,
    alternatives: decision.alternatives,
    predictedSuccess: decision.predictedSuccess,
  };
}
