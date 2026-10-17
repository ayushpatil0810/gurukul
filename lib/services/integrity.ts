import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batchMembers,
  batchTrainers,
  batches,
  events,
  integrityRuns,
  learningSessions,
  questions,
  reviews,
  signals,
  user,
} from "@/db/schema";
import { decideReviewRead } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/actor";
import { assertActorRole } from "@/lib/auth/actor";
import {
  BASELINE_MIN_SAMPLES,
  detectSignals,
  INTEGRITY_RULE_VERSION,
  typingSamples,
  type IntegrityEvent,
  type SignalType,
} from "@/lib/engine/integrity-signals";
import { buildReplayTimeline } from "@/lib/engine/replay-timeline";
import { AppError } from "@/lib/errors";

const SIGNAL_TYPES = ["large_paste", "faster_than_rhythm", "no_write_run_fix", "evenly_typed"] as const;
const REVIEW_STATUSES = ["pending", "dismissed", "needs_viva", "escalated"] as const;
export type ReviewDisposition = "dismissed" | "needs_viva" | "escalated";

export type ReviewQueueItem = {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  batchName: string | null;
  questionStatement: string;
  type: string;
  strength: string;
  confidence: number;
  reviewStatus: string;
  tStart: number;
  tEnd: number;
  explanation: string;
  replayHref: string;
  createdAt?: string;
  metrics?: Record<string, unknown>;
};

export type SignalReviewRecord = {
  id: string;
  reviewerName: string;
  disposition: string;
  note: string;
  createdAt: string;
};

export type SignalDetail = ReviewQueueItem & {
  seqStart: number;
  seqEnd: number;
  evidenceSeqs: number[];
  metrics: Record<string, unknown>;
  context: string[];
  limitations: string[];
  recordingNotes: string[];
  supported: boolean;
  ruleVersion: string;
  createdAt: string;
  reviews: SignalReviewRecord[];
};

export async function persistSessionSignals(sessionId: string): Promise<{
  skipped: "practice" | null;
  signalIds: string[];
  withdrawn: number;
  withheld: { rule: string; reason: string }[];
}> {
  const [session] = await db
    .select({
      id: learningSessions.id,
      instituteId: learningSessions.instituteId,
      studentId: learningSessions.studentId,
      mode: learningSessions.mode,
    })
    .from(learningSessions)
    .where(eq(learningSessions.id, sessionId))
    .limit(1);
  if (!session) throw AppError.notFound("Session not found");
  if (session.mode !== "graded") {
    return { skipped: "practice", signalIds: [], withdrawn: 0, withheld: [] };
  }

  const stored = await db
    .select({ seq: events.seq, t: events.t, type: events.type, payload: events.payloadJson })
    .from(events)
    .where(eq(events.sessionId, sessionId))
    .orderBy(asc(events.seq));
  const timeline = stored.map((event) => ({
    seq: event.seq,
    t: event.t,
    type: event.type,
    payload: event.payload,
  }));
  const [baseline, priorTexts] = await Promise.all([
    loadBaseline(session.studentId, sessionId),
    loadPriorSubmissionTexts(session.studentId, sessionId),
  ]);
  const detected = detectSignals(timeline, { baseline, priorSubmissionTexts: priorTexts });
  const now = new Date();
  const signalIds: string[] = [];

  const withdrawn = await db.transaction(async (tx) => {
    for (const finding of detected.signals) {
      const [row] = await tx
        .insert(signals)
        .values({
          instituteId: session.instituteId,
          sessionId: session.id,
          studentId: session.studentId,
          type: finding.type,
          strength: finding.strength,
          confidence: finding.confidence,
          tStart: finding.tStart,
          tEnd: finding.tEnd,
          seqStart: finding.seqStart,
          seqEnd: finding.seqEnd,
          metricsJson: scrubMetrics(finding.metrics),
          explanation: finding.explanation,
          contextJson: finding.context,
          evidenceJson: finding.evidenceSeqs,
          limitationsJson: finding.limitations,
          ruleVersion: finding.ruleVersion,
          dedupeKey: finding.dedupeKey,
        })
        .onConflictDoUpdate({
          target: [signals.sessionId, signals.dedupeKey],
          set: {
            strength: finding.strength,
            confidence: finding.confidence,
            tStart: finding.tStart,
            tEnd: finding.tEnd,
            seqStart: finding.seqStart,
            seqEnd: finding.seqEnd,
            metricsJson: scrubMetrics(finding.metrics),
            explanation: finding.explanation,
            contextJson: finding.context,
            evidenceJson: finding.evidenceSeqs,
            limitationsJson: finding.limitations,
            supported: true,
            updatedAt: now,
          },
        })
        .returning({ id: signals.id });
      if (row) signalIds.push(row.id);
    }

    const keys = detected.signals.map((finding) => finding.dedupeKey);
    const withdrawn = await tx
      .update(signals)
      .set({ supported: false, updatedAt: now })
      .where(
        and(
          eq(signals.sessionId, session.id),
          eq(signals.ruleVersion, INTEGRITY_RULE_VERSION),
          eq(signals.supported, true),
          keys.length > 0 ? notInArray(signals.dedupeKey, keys) : undefined,
        ),
      )
      .returning({ id: signals.id });

    await tx
      .insert(integrityRuns)
      .values({
        sessionId: session.id,
        instituteId: session.instituteId,
        ruleVersion: INTEGRITY_RULE_VERSION,
        withheldJson: detected.withheld,
        analyzedAt: now,
      })
      .onConflictDoUpdate({
        target: integrityRuns.sessionId,
        set: {
          ruleVersion: INTEGRITY_RULE_VERSION,
          withheldJson: detected.withheld,
          analyzedAt: now,
        },
      });

    return withdrawn.length;
  });

  return {
    skipped: null,
    signalIds,
    withdrawn,
    withheld: detected.withheld,
  };
}

export async function listReviewQueue(
  actor: Actor,
  filter: { batchId?: string; type?: string; status?: string; sessionId?: string } = {},
): Promise<ReviewQueueItem[]> {
  assertActorRole(actor, ["trainer", "admin"]);
  if (filter.type && !SIGNAL_TYPES.includes(filter.type as (typeof SIGNAL_TYPES)[number])) {
    throw AppError.badRequest("Unknown signal type");
  }
  if (filter.status && !REVIEW_STATUSES.includes(filter.status as (typeof REVIEW_STATUSES)[number])) {
    throw AppError.badRequest("Unknown review status");
  }

  const conditions = [
    eq(signals.instituteId, actor.instituteId!),
    eq(signals.supported, true),
    filter.type ? eq(signals.type, filter.type) : undefined,
    filter.status ? eq(signals.reviewStatus, filter.status) : undefined,
    filter.sessionId ? eq(signals.sessionId, filter.sessionId) : undefined,
  ];
  if (actor.role === "trainer") {
    const allowed = await trainerStudentIds(actor.id);
    if (allowed.length === 0) return [];
    conditions.push(inArray(signals.studentId, allowed));
  }
  if (filter.batchId) {
    const members = await db
      .select({ studentId: batchMembers.studentId })
      .from(batchMembers)
      .innerJoin(batches, eq(batches.id, batchMembers.batchId))
      .where(and(eq(batchMembers.batchId, filter.batchId), eq(batches.instituteId, actor.instituteId!)));
    const ids = members.map((row) => row.studentId);
    if (ids.length === 0) return [];
    conditions.push(inArray(signals.studentId, ids));
  }

  const rows = await db
    .select({
      id: signals.id,
      sessionId: signals.sessionId,
      studentId: signals.studentId,
      studentName: user.name,
      studentEmail: user.email,
      questionStatement: questions.statement,
      type: signals.type,
      strength: signals.strength,
      confidence: signals.confidence,
      reviewStatus: signals.reviewStatus,
      tStart: signals.tStart,
      tEnd: signals.tEnd,
      explanation: signals.explanation,
      metricsJson: signals.metricsJson,
      createdAt: signals.createdAt,
    })
    .from(signals)
    .innerJoin(user, eq(user.id, signals.studentId))
    .innerJoin(learningSessions, eq(learningSessions.id, signals.sessionId))
    .innerJoin(questions, eq(questions.id, learningSessions.questionId))
    .where(and(...conditions))
    .orderBy(
      sql`case ${signals.strength} when 'high' then 0 when 'medium' then 1 else 2 end`,
      desc(signals.createdAt),
    );

  const batchNames = await batchNameByStudent(rows.map((row) => row.studentId));
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    studentId: row.studentId,
    studentName: row.studentName,
    studentEmail: row.studentEmail,
    batchName: batchNames.get(row.studentId) ?? null,
    questionStatement: row.questionStatement,
    type: row.type,
    strength: row.strength,
    confidence: row.confidence,
    reviewStatus: row.reviewStatus,
    tStart: row.tStart,
    tEnd: row.tEnd,
    explanation: row.explanation,
    replayHref: replayHref(row.sessionId, row.tStart, row.tEnd),
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    metrics: row.metricsJson as Record<string, unknown> | undefined,
  }));
}

export async function readSignal(actor: Actor, signalId: string): Promise<SignalDetail> {
  const loaded = await loadAuthorizedSignal(actor, signalId);
  const history = await db
    .select({
      id: reviews.id,
      reviewerName: user.name,
      disposition: reviews.disposition,
      note: reviews.note,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(user, eq(user.id, reviews.reviewerId))
    .where(eq(reviews.signalId, loaded.id))
    .orderBy(asc(reviews.createdAt));
  const [run] = await db
    .select({ withheldJson: integrityRuns.withheldJson })
    .from(integrityRuns)
    .where(eq(integrityRuns.sessionId, loaded.sessionId))
    .limit(1);
  const storedEvents = await db
    .select({ seq: events.seq, t: events.t, type: events.type, payload: events.payloadJson })
    .from(events)
    .where(eq(events.sessionId, loaded.sessionId))
    .orderBy(asc(events.chainIndex));
  const timeline = buildReplayTimeline(
    storedEvents.map((event) => ({
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: event.payload,
      chainIndex: undefined,
    })),
  );
  const overlap = timeline.frames.filter(
    (frame) => !frame.playable && frame.t >= loaded.tStart && frame.t <= loaded.tEnd && frame.reason,
  );
  const related = relatedWithheld(loaded.type);
  const recordingNotes = [
    ...new Set([
      ...(run?.withheldJson ?? []).filter((item) => item.rule === related).map((item) => item.reason),
      ...overlap.map((frame) => `Replay cannot rebuild sequence ${frame.seq} (${frame.reason}).`),
    ]),
  ];
  const batchNames = await batchNameByStudent([loaded.studentId]);
  return {
    id: loaded.id,
    sessionId: loaded.sessionId,
    studentId: loaded.studentId,
    studentName: loaded.studentName,
    batchName: batchNames.get(loaded.studentId) ?? null,
    questionStatement: loaded.questionStatement,
    type: loaded.type,
    strength: loaded.strength,
    confidence: loaded.confidence,
    reviewStatus: loaded.reviewStatus,
    tStart: loaded.tStart,
    tEnd: loaded.tEnd,
    seqStart: loaded.seqStart,
    seqEnd: loaded.seqEnd,
    evidenceSeqs: loaded.evidenceJson,
    metrics: loaded.metricsJson,
    context: loaded.contextJson,
    limitations: loaded.limitationsJson,
    recordingNotes,
    supported: loaded.supported,
    ruleVersion: loaded.ruleVersion,
    explanation: loaded.explanation,
    createdAt: loaded.createdAt.toISOString(),
    replayHref: replayHref(loaded.sessionId, loaded.tStart, loaded.tEnd),
    reviews: history.map((review) => ({
      id: review.id,
      reviewerName: review.reviewerName,
      disposition: review.disposition,
      note: review.note,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

export async function recordSignalReview(
  actor: Actor,
  signalId: string,
  input: { disposition: ReviewDisposition; note?: string },
): Promise<SignalDetail> {
  if (!REVIEW_STATUSES.includes(input.disposition)) {
    throw AppError.badRequest("Choose dismissed, needs viva, or escalated");
  }
  const note = (input.note ?? "").trim();
  if (input.disposition === "escalated" && note.length === 0) {
    throw AppError.badRequest("An escalated review needs a written note");
  }
  const loaded = await loadAuthorizedSignal(actor, signalId);
  await db.insert(reviews).values({
    instituteId: loaded.instituteId,
    signalId: loaded.id,
    reviewerId: actor.id,
    disposition: input.disposition,
    note,
  });
  await db
    .update(signals)
    .set({ reviewStatus: input.disposition, updatedAt: new Date() })
    .where(eq(signals.id, loaded.id));
  return readSignal(actor, signalId);
}

export async function listReviewBatches(actor: Actor): Promise<{ id: string; name: string }[]> {
  assertActorRole(actor, ["trainer", "admin"]);
  if (actor.role === "admin") {
    return db
      .select({ id: batches.id, name: batches.name })
      .from(batches)
      .where(eq(batches.instituteId, actor.instituteId!))
      .orderBy(asc(batches.name));
  }
  return db
    .select({ id: batches.id, name: batches.name })
    .from(batches)
    .innerJoin(batchTrainers, eq(batchTrainers.batchId, batches.id))
    .where(eq(batchTrainers.trainerId, actor.id))
    .orderBy(asc(batches.name));
}

export function signalLabel(type: string): string {
  if (type === "large_paste") return "Large paste";
  if (type === "faster_than_rhythm") return "Unusual typing burst";
  if (type === "no_write_run_fix") return "No write-run-fix iteration";
  if (type === "evenly_typed") return "Unusually uniform typing";
  return type;
}

function relatedWithheld(type: string): string {
  if (type === "large_paste") return "large_paste";
  if (type === "faster_than_rhythm") return "typing_burst";
  if (type === "no_write_run_fix") return "no_iteration";
  return "uniform_typing";
}

function replayHref(sessionId: string, tStart: number, tEnd: number): string {
  return `/replay/${sessionId}?t=${encodeURIComponent(String(tStart))}&from=${encodeURIComponent(String(tStart))}&to=${encodeURIComponent(String(tEnd))}`;
}

async function loadAuthorizedSignal(actor: Actor, signalId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const [row] = await db
    .select({
      id: signals.id,
      instituteId: signals.instituteId,
      sessionId: signals.sessionId,
      studentId: signals.studentId,
      studentName: user.name,
      questionStatement: questions.statement,
      type: signals.type,
      strength: signals.strength,
      confidence: signals.confidence,
      reviewStatus: signals.reviewStatus,
      tStart: signals.tStart,
      tEnd: signals.tEnd,
      seqStart: signals.seqStart,
      seqEnd: signals.seqEnd,
      evidenceJson: signals.evidenceJson,
      metricsJson: signals.metricsJson,
      contextJson: signals.contextJson,
      limitationsJson: signals.limitationsJson,
      supported: signals.supported,
      ruleVersion: signals.ruleVersion,
      explanation: signals.explanation,
      createdAt: signals.createdAt,
      sessionInstituteId: learningSessions.instituteId,
    })
    .from(signals)
    .innerJoin(user, eq(user.id, signals.studentId))
    .innerJoin(learningSessions, eq(learningSessions.id, signals.sessionId))
    .innerJoin(questions, eq(questions.id, learningSessions.questionId))
    .where(eq(signals.id, signalId))
    .limit(1);

  const sharesBatch = row && actor.role === "trainer" ? await trainerSharesStudent(actor.id, row.studentId) : false;
  const decision = decideReviewRead({
    actor,
    session: row ? { instituteId: row.sessionInstituteId, studentId: row.studentId } : null,
    sharesBatch,
  });
  if (decision === "not_found") throw AppError.notFound("Review item not found");
  if (decision === "forbidden") throw AppError.forbidden("You do not have access to this review");
  if (!row) throw AppError.notFound("Review item not found");
  return row;
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

async function trainerStudentIds(trainerId: string): Promise<string[]> {
  const rows = await db
    .select({ studentId: batchMembers.studentId })
    .from(batchMembers)
    .innerJoin(
      batchTrainers,
      and(eq(batchTrainers.batchId, batchMembers.batchId), eq(batchTrainers.trainerId, trainerId)),
    );
  return [...new Set(rows.map((row) => row.studentId))];
}

async function batchNameByStudent(studentIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(studentIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ studentId: batchMembers.studentId, name: batches.name })
    .from(batchMembers)
    .innerJoin(batches, eq(batches.id, batchMembers.batchId))
    .where(inArray(batchMembers.studentId, unique));
  const names = new Map<string, string>();
  for (const row of rows) {
    const current = names.get(row.studentId);
    names.set(row.studentId, current ? `${current}, ${row.name}` : row.name);
  }
  return names;
}

async function loadBaseline(studentId: string, sessionId: string) {
  const rows = await db
    .select({ seq: events.seq, t: events.t, type: events.type, payload: events.payloadJson })
    .from(events)
    .innerJoin(learningSessions, eq(learningSessions.id, events.sessionId))
    .where(
      and(
        eq(learningSessions.studentId, studentId),
        eq(learningSessions.mode, "graded"),
        sql`${learningSessions.id} <> ${sessionId}`,
        eq(events.type, "insert"),
      ),
    )
    .orderBy(desc(learningSessions.startedAt), asc(events.seq))
    .limit(2000);
  const samples = typingSamples(rows as IntegrityEvent[]);
  if (samples.length < BASELINE_MIN_SAMPLES) return null;
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
  return { meanCps: mean, sdCps: Math.sqrt(variance), samples: samples.length };
}

async function loadPriorSubmissionTexts(studentId: string, sessionId: string): Promise<string[]> {
  const rows = await db
    .select({ code: attempts.code })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .where(
      and(
        eq(learningSessions.studentId, studentId),
        eq(attempts.kind, "submit"),
        sql`${learningSessions.id} <> ${sessionId}`,
      ),
    )
    .orderBy(desc(attempts.createdAt))
    .limit(20);
  return rows.map((row) => row.code);
}

function scrubMetrics(metrics: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (key === "text" || key === "code" || key === "baseline" || key === "removed") continue;
    if (typeof value === "string" && value.length > 160) continue;
    next[key] = value;
  }
  return next;
}

function isSignalType(value: string): value is SignalType {
  return SIGNAL_TYPES.includes(value as SignalType);
}
