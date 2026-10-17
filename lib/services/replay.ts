import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batches,
  batchMembers,
  batchTrainers,
  events,
  learningSessions,
  questions,
  signals,
  user,
} from "@/db/schema";
import { decideReplayRead } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/actor";
import { assertActorRole } from "@/lib/auth/actor";
import { verifyEventChain } from "@/lib/engine/event-chain";
import type { ReplaySourceEvent } from "@/lib/engine/replay-timeline";
import { AppError } from "@/lib/errors";

export type ReplaySessionSummary = {
  id: string;
  mode: string;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  batchName?: string | null;
  questionStatement: string;
  questionDifficulty?: number;
  passRate?: number | null;
  passedCount?: number | null;
  totalTests?: number | null;
  signalsCount?: number;
  latestSignalId?: string | null;
  latestSignalType?: string | null;
  latestSignalStrength?: string | null;
  latestSignalConfidence?: number | null;
  reviewStatus?: string | null;
  eventCount?: number;
};

export type ReplayView = {
  session: {
    id: string;
    mode: string;
    startedAt: string;
    endedAt: string | null;
    studentName: string;
    questionStatement: string;
    questionDifficulty: number;
  };
  chainValid: boolean;
  events: ReplaySourceEvent[];
};

export async function listReplaySessions(actor: Actor): Promise<ReplaySessionSummary[]> {
  assertActorRole(actor, ["trainer", "admin"]);
  const rows = await db
    .select({
      id: learningSessions.id,
      mode: learningSessions.mode,
      startedAt: learningSessions.startedAt,
      endedAt: learningSessions.endedAt,
      studentId: learningSessions.studentId,
      studentName: user.name,
      studentEmail: user.email,
      questionStatement: questions.statement,
      questionDifficulty: questions.difficulty,
    })
    .from(learningSessions)
    .innerJoin(user, eq(user.id, learningSessions.studentId))
    .innerJoin(questions, eq(questions.id, learningSessions.questionId))
    .where(eq(learningSessions.instituteId, actor.instituteId!))
    .orderBy(desc(learningSessions.startedAt));

  const allowed = actor.role === "admin" ? rows : await filterTrainerRows(actor.id, rows);
  if (allowed.length === 0) return [];

  const sessionIds = allowed.map((r) => r.id);
  const studentIds = Array.from(new Set(allowed.map((r) => r.studentId)));

  const [batchRows, attemptRows, signalRows, eventCountRows] = await Promise.all([
    db
      .select({
        studentId: batchMembers.studentId,
        batchName: batches.name,
      })
      .from(batchMembers)
      .innerJoin(batches, eq(batches.id, batchMembers.batchId))
      .where(inArray(batchMembers.studentId, studentIds)),
    db
      .select({
        sessionId: attempts.sessionId,
        passRate: attempts.passRate,
        resultJson: attempts.resultJson,
        createdAt: attempts.createdAt,
      })
      .from(attempts)
      .where(inArray(attempts.sessionId, sessionIds))
      .orderBy(desc(attempts.createdAt)),
    db
      .select({
        id: signals.id,
        sessionId: signals.sessionId,
        type: signals.type,
        strength: signals.strength,
        confidence: signals.confidence,
        reviewStatus: signals.reviewStatus,
        createdAt: signals.createdAt,
      })
      .from(signals)
      .where(inArray(signals.sessionId, sessionIds))
      .orderBy(desc(signals.createdAt)),
    db
      .select({
        sessionId: events.sessionId,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(inArray(events.sessionId, sessionIds))
      .groupBy(events.sessionId),
  ]);

  const batchMap = new Map<string, string>();
  for (const b of batchRows) {
    if (!batchMap.has(b.studentId)) batchMap.set(b.studentId, b.batchName);
  }

  const attemptMap = new Map<string, (typeof attemptRows)[number]>();
  for (const a of attemptRows) {
    if (!attemptMap.has(a.sessionId)) attemptMap.set(a.sessionId, a);
  }

  const signalsBySession = new Map<string, typeof signalRows>();
  for (const s of signalRows) {
    const arr = signalsBySession.get(s.sessionId) ?? [];
    arr.push(s);
    signalsBySession.set(s.sessionId, arr);
  }

  const eventCountMap = new Map<string, number>();
  for (const ec of eventCountRows) {
    eventCountMap.set(ec.sessionId, ec.count);
  }

  return allowed.map((row) => {
    const durationSeconds = row.endedAt
      ? Math.max(0, Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 1000))
      : null;
    const latestAttempt = attemptMap.get(row.id);
    let passedCount: number | null = null;
    let totalTests: number | null = null;
    if (latestAttempt?.resultJson && typeof latestAttempt.resultJson === "object") {
      const res = latestAttempt.resultJson as { passed?: number; total?: number };
      if (typeof res.passed === "number") passedCount = res.passed;
      if (typeof res.total === "number") totalTests = res.total;
    }

    const sessionSignals = signalsBySession.get(row.id) ?? [];
    const latestSignal = sessionSignals[0] ?? null;

    return {
      id: row.id,
      mode: row.mode,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      durationSeconds,
      studentId: row.studentId,
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      batchName: batchMap.get(row.studentId) ?? null,
      questionStatement: row.questionStatement,
      questionDifficulty: row.questionDifficulty,
      passRate: latestAttempt?.passRate ?? null,
      passedCount,
      totalTests,
      signalsCount: sessionSignals.length,
      latestSignalId: latestSignal?.id ?? null,
      latestSignalType: latestSignal?.type ?? null,
      latestSignalStrength: latestSignal?.strength ?? null,
      latestSignalConfidence: latestSignal?.confidence ?? null,
      reviewStatus: latestSignal?.reviewStatus ?? null,
      eventCount: eventCountMap.get(row.id) ?? 0,
    };
  });
}

export async function readReplay(actor: Actor, sessionId: string): Promise<ReplayView> {
  if (!actor.instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  const [row] = await db
    .select({
      id: learningSessions.id,
      instituteId: learningSessions.instituteId,
      studentId: learningSessions.studentId,
      mode: learningSessions.mode,
      startedAt: learningSessions.startedAt,
      endedAt: learningSessions.endedAt,
      studentName: user.name,
      questionStatement: questions.statement,
      questionDifficulty: questions.difficulty,
    })
    .from(learningSessions)
    .innerJoin(user, eq(user.id, learningSessions.studentId))
    .innerJoin(questions, eq(questions.id, learningSessions.questionId))
    .where(eq(learningSessions.id, sessionId))
    .limit(1);

  const sharesBatch = row && actor.role === "trainer" ? await trainerSharesStudent(actor.id, row.studentId) : false;
  const decision = decideReplayRead({
    actor,
    session: row ? { instituteId: row.instituteId, studentId: row.studentId } : null,
    sharesBatch,
  });
  if (decision === "not_found") throw AppError.notFound("Recording not found");
  if (decision === "forbidden") throw AppError.forbidden("You do not have access to this recording");
  if (!row) throw AppError.notFound("Recording not found");

  const stored = await db
    .select({
      seq: events.seq,
      t: events.t,
      type: events.type,
      payload: events.payloadJson,
      prevHash: events.prevHash,
      chainIndex: events.chainIndex,
      schemaVersion: events.schemaVersion,
    })
    .from(events)
    .where(and(eq(events.sessionId, row.id), eq(events.instituteId, row.instituteId)))
    .orderBy(asc(events.chainIndex));

  const chainValid = verifyEventChain(
    stored.map((event) => ({
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: event.payload,
      prevHash: event.prevHash,
      chainIndex: event.chainIndex,
      schemaVersion: event.schemaVersion,
    })),
  );

  return {
    session: {
      id: row.id,
      mode: row.mode,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      studentName: row.studentName,
      questionStatement: row.questionStatement,
      questionDifficulty: row.questionDifficulty,
    },
    chainValid,
    events: stored.map((event) => ({
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: scrubReplayPayload(event.payload),
      chainIndex: event.chainIndex,
      schemaVersion: event.schemaVersion,
    })),
  };
}

async function filterTrainerRows<T extends { studentId: string }>(trainerId: string, rows: T[]): Promise<T[]> {
  if (rows.length === 0) return [];
  const memberships = await db
    .select({ studentId: batchMembers.studentId })
    .from(batchMembers)
    .innerJoin(
      batchTrainers,
      and(eq(batchTrainers.batchId, batchMembers.batchId), eq(batchTrainers.trainerId, trainerId)),
    );
  const allowed = new Set(memberships.map((row) => row.studentId));
  return rows.filter((row) => allowed.has(row.studentId));
}

const HIDDEN_PAYLOAD_KEYS = new Set([
  "referenceSolution",
  "reference_solution",
  "expectedOutput",
  "expected_output",
  "hiddenTests",
  "password",
  "token",
]);

function scrubReplayPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => scrubReplayPayload(item));
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (HIDDEN_PAYLOAD_KEYS.has(key)) continue;
    next[key] = scrubReplayPayload(child);
  }
  return next;
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
