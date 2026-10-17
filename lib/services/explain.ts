import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batchMembers,
  batchTrainers,
  explainQa,
  explainSets,
  learningSessions,
  submissionLanguages,
  user,
  type ExplainCodeRef,
  type ExplainGrader,
  type SubmissionLanguage,
} from "@/db/schema";
import { decideReplayRead, decideStudentRead } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/actor";
import {
  gradeExplainAnswer,
  questionsFromUntrusted,
  generateExplainQuestions,
  type ExplainDraft,
} from "@/lib/engine/explain-questions";
import { AppError } from "@/lib/errors";
import type { SandboxRunner } from "@/sandbox/types";
import { DockerSandboxRunner } from "@/sandbox/docker-runner";

const defaultRunner = new DockerSandboxRunner();

export type ExplainAnswerInput = { id: string; text: string };

export type PublicExplainQuestion = {
  id: string;
  type: string;
  prompt: string;
  startLine: number;
  endLine: number;
  quote: string;
  answer: string | null;
  verdict: "yes" | "partial" | "no" | null;
  verdictLabel: string | null;
  evidence: string[];
  missed: string[];
  method: string | null;
  confidence: number | null;
  reviewStatus: "none" | "needs_review" | null;
};

export type PublicExplainSet = {
  id: string;
  attemptId: string;
  sessionId: string;
  status: "open" | "answered" | "unavailable";
  note: string | null;
  language: string;
  codeSnapshot: string;
  questions: PublicExplainQuestion[];
};

type StoredQuestion = {
  id: string;
  type: string;
  questionText: string;
  codeRefs: ExplainCodeRef[];
  answerText: string | null;
  verdict: "yes" | "partial" | "no" | null;
  evidenceJson: string[] | null;
  missedPoints: string[];
  method: string | null;
  confidence: number | null;
  reviewStatus: "none" | "needs_review";
  graderJson: ExplainGrader | null;
};

type AttemptContext = {
  attemptId: string;
  code: string;
  language: string;
  kind: string;
  sessionId: string;
  mode: string;
  instituteId: string;
  studentId: string;
  studentRole: string;
  studentInstituteId: string | null;
};

export async function ensureExplanation(
  actor: Actor,
  attemptId: string,
  runner: SandboxRunner = defaultRunner,
): Promise<PublicExplainSet> {
  const attempt = await loadAttempt(attemptId);
  assertStudentOwner(actor, attempt);
  assertGradedSubmission(attempt);
  const existing = await readSet(attempt.attemptId);
  if (existing) return existing;

  const language = asLanguage(attempt.language);
  const generated = await generateExplainQuestions({ code: attempt.code, language, runner });
  const questions = questionsFromUntrusted(generated.questions, generated.questions);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(explainSets).values({
        instituteId: attempt.instituteId,
        attemptId: attempt.attemptId,
        sessionId: attempt.sessionId,
        studentId: attempt.studentId,
        language,
        codeSnapshot: attempt.code,
        status: questions.length >= 2 ? "open" : "unavailable",
        note: questions.length >= 2 ? null : generated.note,
      });
      if (questions.length >= 2) {
        await tx.insert(explainQa).values(questions.map((question) => toRow(attempt, question)));
      }
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const stored = await readSet(attempt.attemptId);
  if (!stored) throw AppError.internal("The explanation could not be stored");
  return stored;
}

export async function readExplanation(actor: Actor, attemptId: string): Promise<PublicExplainSet> {
  const attempt = await loadAttempt(attemptId);
  await assertCanRead(actor, attempt);
  const stored = await readSet(attempt.attemptId);
  if (!stored) throw AppError.notFound("Explanation not found");
  return stored;
}

export async function answerExplanation(
  actor: Actor,
  attemptId: string,
  answers: ExplainAnswerInput[],
): Promise<PublicExplainSet> {
  const attempt = await loadAttempt(attemptId);
  assertStudentOwner(actor, attempt);
  const [set] = await db.select().from(explainSets).where(eq(explainSets.attemptId, attemptId)).limit(1);
  if (!set) throw AppError.notFound("Explanation not found");
  if (set.status === "unavailable") throw AppError.badRequest("This submission has no explanation questions");
  if (set.status === "answered") {
    const stored = await readSet(attemptId);
    if (!stored) throw AppError.notFound("Explanation not found");
    return stored;
  }

  const rows = await db.select().from(explainQa).where(eq(explainQa.attemptId, attemptId));
  if (answers.length !== rows.length) throw AppError.badRequest("Answer every question once");
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  for (const answer of answers) {
    if (seen.has(answer.id) || !byId.has(answer.id)) throw AppError.badRequest("Answer every question once");
    seen.add(answer.id);
  }

  const answeredAt = new Date();
  await db.transaction(async (tx) => {
    for (const answer of answers) {
      const row = byId.get(answer.id);
      if (!row) continue;
      const ref = firstRef(row.codeRefs as ExplainCodeRef[] | null);
      const grade = gradeExplainAnswer(
        {
          grader: (row.graderJson as ExplainGrader | null) ?? { method: "facts", expected: null, tokens: [], literal: null },
          quote: ref?.quote ?? "",
          startLine: ref?.startLine ?? 1,
        },
        answer.text,
      );
      await tx
        .update(explainQa)
        .set({
          answerText: answer.text,
          verdict: grade.verdict,
          evidenceJson: grade.evidence,
          missedPoints: grade.missed,
          method: grade.method,
          confidence: grade.confidence,
          reviewStatus: grade.reviewStatus,
          answeredAt,
        })
        .where(and(eq(explainQa.id, answer.id), eq(explainQa.attemptId, attemptId)));
    }
    await tx
      .update(explainSets)
      .set({ status: "answered", answeredAt })
      .where(eq(explainSets.attemptId, attemptId));
  });

  const stored = await readSet(attemptId);
  if (!stored) throw AppError.notFound("Explanation not found");
  return stored;
}

export async function listSessionExplanations(actor: Actor, sessionId: string): Promise<PublicExplainSet[]> {
  if (!actor.instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  const [session] = await db
    .select({
      instituteId: learningSessions.instituteId,
      studentId: learningSessions.studentId,
    })
    .from(learningSessions)
    .where(eq(learningSessions.id, sessionId))
    .limit(1);
  const sharesBatch = session && actor.role === "trainer" ? await trainerSharesStudent(actor.id, session.studentId) : false;
  const decision = decideReplayRead({
    actor,
    session: session ? { instituteId: session.instituteId, studentId: session.studentId } : null,
    sharesBatch,
  });
  if (decision === "not_found") throw AppError.notFound("Recording not found");
  if (decision === "forbidden") throw AppError.forbidden("You do not have access to this recording");

  const sets = await db
    .select({ attemptId: explainSets.attemptId })
    .from(explainSets)
    .where(eq(explainSets.sessionId, sessionId))
    .orderBy(asc(explainSets.createdAt));
  const views: PublicExplainSet[] = [];
  for (const set of sets) {
    const view = await readSet(set.attemptId);
    if (view) views.push(view);
  }
  return views;
}

async function loadAttempt(attemptId: string): Promise<AttemptContext> {
  const [row] = await db
    .select({
      attemptId: attempts.id,
      code: attempts.code,
      language: attempts.language,
      kind: attempts.kind,
      sessionId: learningSessions.id,
      mode: learningSessions.mode,
      instituteId: learningSessions.instituteId,
      studentId: learningSessions.studentId,
      studentRole: user.role,
      studentInstituteId: user.instituteId,
    })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .innerJoin(user, eq(user.id, learningSessions.studentId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!row) throw AppError.notFound("Submission not found");
  return row;
}

function assertStudentOwner(actor: Actor, attempt: AttemptContext) {
  const decision = decideStudentRead({
    actor,
    student: {
      id: attempt.studentId,
      role: attempt.studentRole as "student",
      instituteId: attempt.studentInstituteId,
    },
    sharesBatch: false,
  });
  if (actor.role !== "student" || actor.id !== attempt.studentId) {
    if (decision === "not_found") throw AppError.notFound("Submission not found");
    throw AppError.forbidden("Only the student who submitted can answer these questions");
  }
}

async function assertCanRead(actor: Actor, attempt: AttemptContext) {
  const sharesBatch = actor.role === "trainer" ? await trainerSharesStudent(actor.id, attempt.studentId) : false;
  const decision = decideStudentRead({
    actor,
    student: {
      id: attempt.studentId,
      role: attempt.studentRole as "student",
      instituteId: attempt.studentInstituteId,
    },
    sharesBatch,
  });
  if (decision === "not_found") throw AppError.notFound("Submission not found");
  if (decision === "forbidden") throw AppError.forbidden("You do not have access to this explanation");
}

function assertGradedSubmission(attempt: AttemptContext) {
  if (attempt.kind !== "submit" || attempt.mode !== "graded") {
    throw AppError.badRequest("Explanations follow a graded submission");
  }
}

async function readSet(attemptId: string): Promise<PublicExplainSet | null> {
  const [set] = await db.select().from(explainSets).where(eq(explainSets.attemptId, attemptId)).limit(1);
  if (!set) return null;
  const rows = await db.select().from(explainQa).where(eq(explainQa.attemptId, attemptId)).orderBy(asc(explainQa.createdAt));
  const revealed = set.status === "answered";
  return {
    id: set.id,
    attemptId: set.attemptId,
    sessionId: set.sessionId,
    status: set.status as PublicExplainSet["status"],
    note: set.note,
    language: set.language,
    codeSnapshot: set.codeSnapshot,
    questions: rows.map((row) => toPublic(row as StoredQuestion, revealed)),
  };
}

function toPublic(row: StoredQuestion, reveal: boolean): PublicExplainQuestion {
  const ref = firstRef(row.codeRefs);
  return {
    id: row.id,
    type: row.type,
    prompt: row.questionText,
    startLine: ref?.startLine ?? 1,
    endLine: ref?.endLine ?? ref?.startLine ?? 1,
    quote: ref?.quote ?? "",
    answer: reveal ? row.answerText : null,
    verdict: reveal ? row.verdict : null,
    verdictLabel: reveal && row.verdict !== undefined ? verdictLabel(row.verdict) : null,
    evidence: reveal ? (row.evidenceJson ?? []) : [],
    missed: reveal ? (row.missedPoints ?? []) : [],
    method: reveal ? row.method : null,
    confidence: reveal ? row.confidence : null,
    reviewStatus: reveal ? row.reviewStatus : null,
  };
}

function toRow(attempt: AttemptContext, question: ExplainDraft) {
  return {
    instituteId: attempt.instituteId,
    attemptId: attempt.attemptId,
    questionText: question.prompt,
    type: question.type,
    codeRefs: [{ startLine: question.startLine, endLine: question.endLine, quote: question.quote }],
    graderJson: question.grader,
    missedPoints: [],
    reviewStatus: "none" as const,
  };
}

function verdictLabel(verdict: "yes" | "partial" | "no" | null): string | null {
  if (verdict === "yes") return "Correct";
  if (verdict === "partial") return "Partially correct";
  if (verdict === "no") return "Incorrect";
  if (verdict === null) return "Not enough evidence";
  return null;
}

function firstRef(refs: ExplainCodeRef[] | null | undefined): ExplainCodeRef | null {
  return Array.isArray(refs) && refs[0] ? refs[0] : null;
}

function asLanguage(language: string): SubmissionLanguage {
  if ((submissionLanguages as readonly string[]).includes(language)) return language as SubmissionLanguage;
  throw AppError.badRequest("This submission language cannot be explained");
}

function isUniqueViolation(error: unknown): boolean {
  const cause = error && typeof error === "object" && "cause" in error ? String(error.cause) : "";
  const message = error instanceof Error ? error.message : "";
  return `${message} ${cause}`.includes("23505") || `${message} ${cause}`.includes("explain_sets_attempt_id_unique");
}

async function trainerSharesStudent(trainerId: string, studentId: string): Promise<boolean> {
  const [membership] = await db
    .select({ batchId: batchMembers.batchId })
    .from(batchMembers)
    .innerJoin(
      batchTrainers,
      and(eq(batchTrainers.batchId, batchMembers.batchId), eq(batchTrainers.trainerId, trainerId)),
    )
    .where(eq(batchMembers.studentId, studentId))
    .limit(1);
  return Boolean(membership);
}
