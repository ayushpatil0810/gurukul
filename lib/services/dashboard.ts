import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batchMembers,
  batchTrainers,
  batches,
  concepts,
  explainQa,
  explainSets,
  learningSessions,
  masteryState,
  masteryUpdates,
  moduleConcepts,
  modules,
  prerequisites,
  questionConcepts,
  questions,
  routingDecisions,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import {
  assembleHeatmap,
  explanationLabel,
  masteryBand,
  masteryKey,
  orderByPrerequisite,
  summarizeCohort,
  type CohortInsight,
  type ExplanationCounts,
  type HeatCell,
  type MasteryBand,
} from "@/lib/engine/dashboard-bands";
import { AppError } from "@/lib/errors";
import { previewRoute } from "@/lib/services/assessment";
import { publishedLessonForConcept } from "@/lib/services/lessons";
import { listReviewQueue } from "@/lib/services/integrity";
import { readStudentForActor } from "@/lib/services/students";

export type ConceptDashboardRow = {
  id: string;
  name: string;
  pKnow: number | null;
  band: MasteryBand;
  confidenceLabel: string;
  prerequisites: { name: string; state: "met" | "below" | "not_recorded" }[];
  latestUpdate: { before: number; after: number; causeType: string; at: string } | null;
  recentTagged: { counted: number; passedAll: number } | null;
};

export type AttemptDashboardRow = {
  id: string;
  sessionId: string;
  studentName: string;
  at: string;
  statement: string;
  passRate: number | null;
  passed: number | null;
  total: number | null;
  explanation: string;
  replayHref: string | null;
};

export type RecommendationView = {
  conceptId: string;
  conceptName: string;
  reason: string;
  storedMastery: number | null;
  predictedSuccess: number | null;
  hasQuestion: boolean;
  lesson: { id: string; title: string } | null;
  alternatives: { name: string; note: string; storedMastery: number | null }[];
};

export type StudentDashboard = {
  student: { id: string; name: string };
  module: { id: string; name: string; threshold: number; goalName: string } | null;
  recommendation: RecommendationView | null;
  concepts: ConceptDashboardRow[];
  attempts: AttemptDashboardRow[];
  routing: { at: string; reason: string }[];
};

export type TrainerDashboard = {
  batches: { id: string; name: string }[];
  batch: { id: string; name: string } | null;
  module: StudentDashboard["module"];
  students: { id: string; name: string }[];
  concepts: { id: string; name: string }[];
  cells: HeatCell[];
  insights: CohortInsight[];
  attempts: AttemptDashboardRow[];
  pendingReviews: number;
};

export async function readStudentDashboard(actor: Actor, moduleId?: string): Promise<StudentDashboard> {
  if (actor.role !== "student") throw AppError.forbidden("The student dashboard is for students");
  if (!actor.instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  return loadStudentDashboard(actor, actor.id, actor.name, moduleId, false);
}

export async function readStudentDetail(actor: Actor, studentId: string, moduleId?: string): Promise<StudentDashboard> {
  const student = await readStudentForActor(actor, studentId);
  if (!actor.instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  const replay = actor.role === "trainer" || actor.role === "admin";
  return loadStudentDashboard(actor, student.id, student.name, moduleId, replay);
}

export async function readTrainerDashboard(
  actor: Actor,
  input: { batchId?: string; moduleId?: string } = {},
): Promise<TrainerDashboard> {
  if (actor.role !== "trainer" && actor.role !== "admin") {
    throw AppError.forbidden("The batch dashboard is for trainers and admins");
  }
  if (!actor.instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  const available = await listAuthorizedBatches(actor);
  if (input.batchId && !available.some((batch) => batch.id === input.batchId)) {
    const [row] = await db
      .select({ instituteId: batches.instituteId })
      .from(batches)
      .where(eq(batches.id, input.batchId))
      .limit(1);
    if (!row || row.instituteId !== actor.instituteId) throw AppError.notFound("Batch not found");
    throw AppError.forbidden("You do not have access to this batch");
  }
  const batch = available.find((item) => item.id === input.batchId) ?? available[0] ?? null;
  const graph = await loadGraph(actor.instituteId, input.moduleId);
  if (!batch || !graph) {
    return {
      batches: available.map((item) => ({ id: item.id, name: item.name })),
      batch: batch ? { id: batch.id, name: batch.name } : null,
      module: graph?.module ?? null,
      students: [],
      concepts: graph?.concepts.map((concept) => ({ id: concept.id, name: concept.name })) ?? [],
      cells: [],
      insights: [],
      attempts: [],
      pendingReviews: 0,
    };
  }
  const members = await db
    .select({ id: user.id, name: user.name })
    .from(batchMembers)
    .innerJoin(user, eq(user.id, batchMembers.studentId))
    .where(eq(batchMembers.batchId, batch.id))
    .orderBy(user.name);
  const studentIds = members.map((member) => member.id);
  const conceptIds = graph.concepts.map((concept) => concept.id);
  const masteryRows =
    studentIds.length === 0 || conceptIds.length === 0
      ? []
      : await db
          .select({
            studentId: masteryState.studentId,
            conceptId: masteryState.conceptId,
            pKnow: masteryState.pKnow,
          })
          .from(masteryState)
          .where(and(inArray(masteryState.studentId, studentIds), inArray(masteryState.conceptId, conceptIds)));
  const mastery = new Map(masteryRows.map((row) => [masteryKey(row.studentId, row.conceptId), row.pKnow]));
  const orderedIds = orderByPrerequisite(conceptIds, graph.edges);
  const orderedConcepts = orderedIds.map((id) => graph.concepts.find((concept) => concept.id === id)).filter((concept) => concept !== undefined);
  const attempts = await recentAttempts(actor.instituteId, studentIds, true);
  const pending =
    studentIds.length === 0
      ? []
      : await listReviewQueue(actor, { batchId: batch.id, status: "pending" });
  return {
    batches: available.map((item) => ({ id: item.id, name: item.name })),
    batch: { id: batch.id, name: batch.name },
    module: graph.module,
    students: members,
    concepts: orderedConcepts,
    cells: assembleHeatmap({
      studentIds,
      conceptIds: orderedConcepts.map((concept) => concept.id),
      mastery,
      threshold: graph.module.threshold,
    }),
    insights: summarizeCohort({
      students: members,
      concepts: orderedConcepts,
      edges: graph.edges,
      mastery,
      threshold: graph.module.threshold,
    }),
    attempts,
    pendingReviews: pending.length,
  };
}

async function loadStudentDashboard(
  actor: Actor,
  studentId: string,
  studentName: string,
  moduleId: string | undefined,
  includeReplay: boolean,
): Promise<StudentDashboard> {
  const instituteId = actor.instituteId;
  if (!instituteId) throw AppError.forbidden("Your account is not assigned to an institute");
  const graph = await loadGraph(instituteId, moduleId);
  const recommendation = await recommendationFor(studentId, instituteId, moduleId, graph);
  if (!graph) {
    return {
      student: { id: studentId, name: studentName },
      module: null,
      recommendation,
      concepts: [],
      attempts: await recentAttempts(instituteId, [studentId], includeReplay),
      routing: await recentRouting(studentId),
    };
  }
  const conceptIds = graph.concepts.map((concept) => concept.id);
  const masteryRows =
    conceptIds.length === 0
      ? []
      : await db
          .select({
            conceptId: masteryState.conceptId,
            pKnow: masteryState.pKnow,
            confidence: masteryState.confidence,
          })
          .from(masteryState)
          .where(and(eq(masteryState.studentId, studentId), inArray(masteryState.conceptId, conceptIds)));
  const mastery = new Map(masteryRows.map((row) => [row.conceptId, row]));
  const updates =
    conceptIds.length === 0
      ? []
      : await db
          .select({
            conceptId: masteryUpdates.conceptId,
            before: masteryUpdates.before,
            after: masteryUpdates.after,
            causeType: masteryUpdates.causeType,
            createdAt: masteryUpdates.createdAt,
          })
          .from(masteryUpdates)
          .where(and(eq(masteryUpdates.studentId, studentId), inArray(masteryUpdates.conceptId, conceptIds)))
          .orderBy(desc(masteryUpdates.createdAt))
          .limit(100);
  const latest = new Map<string, (typeof updates)[number]>();
  for (const update of updates) {
    if (!latest.has(update.conceptId)) latest.set(update.conceptId, update);
  }
  const tagged = await taggedSubmissions(studentId, conceptIds);
  const names = new Map(graph.concepts.map((concept) => [concept.id, concept.name]));
  const prereqByConcept = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = prereqByConcept.get(edge.conceptId) ?? [];
    list.push(edge.requiresId);
    prereqByConcept.set(edge.conceptId, list);
  }
  const ordered = orderByPrerequisite(conceptIds, graph.edges);
  const concepts = ordered.map((id) => {
    const row = mastery.get(id);
    const pKnow = row?.pKnow ?? null;
    const update = latest.get(id);
    const recent = tagged.get(id) ?? [];
    const passedAll = recent.filter((rate) => rate !== null && rate >= 1).length;
    return {
      id,
      name: names.get(id) ?? id,
      pKnow,
      band: masteryBand(pKnow, graph.module.threshold),
      confidenceLabel: confidenceLabel(row?.confidence),
      prerequisites: (prereqByConcept.get(id) ?? []).map((required) => {
        const requiredMastery = mastery.get(required)?.pKnow ?? null;
        const state =
          requiredMastery === null ? "not_recorded" : requiredMastery >= graph.module.threshold ? "met" : "below";
        return { name: names.get(required) ?? required, state } as const;
      }),
      latestUpdate: update
        ? {
            before: update.before,
            after: update.after,
            causeType: update.causeType,
            at: formatUtc(update.createdAt),
          }
        : null,
      recentTagged: recent.length === 0 ? null : { counted: recent.length, passedAll },
    } satisfies ConceptDashboardRow;
  });
  return {
    student: { id: studentId, name: studentName },
    module: graph.module,
    recommendation,
    concepts,
    attempts: await recentAttempts(instituteId, [studentId], includeReplay),
    routing: await recentRouting(studentId),
  };
}

async function recommendationFor(
  studentId: string,
  instituteId: string,
  moduleId: string | undefined,
  graph: Graph | null,
): Promise<RecommendationView | null> {
  try {
    const preview = await previewRoute(studentId, instituteId, moduleId);
    const stored = new Map((graph?.concepts ?? []).map((concept) => [concept.id, concept]));
    const masteryRows =
      graph && graph.concepts.length > 0
        ? await db
            .select({ conceptId: masteryState.conceptId, pKnow: masteryState.pKnow })
            .from(masteryState)
            .where(
              and(
                eq(masteryState.studentId, studentId),
                inArray(
                  masteryState.conceptId,
                  graph.concepts.map((concept) => concept.id),
                ),
              ),
            )
        : [];
    const recorded = new Map(masteryRows.map((row) => [row.conceptId, row.pKnow]));
    const chosen = stored.get(preview.decision.conceptId);
    const lesson = await publishedLessonForConcept(instituteId, preview.decision.conceptId);
    return {
      conceptId: preview.decision.conceptId,
      conceptName: chosen?.name ?? preview.decision.conceptId,
      reason: preview.decision.reason,
      storedMastery: recorded.has(preview.decision.conceptId) ? (recorded.get(preview.decision.conceptId) ?? null) : null,
      predictedSuccess: preview.decision.predictedSuccess,
      hasQuestion: preview.decision.questionId !== null,
      lesson,
      alternatives: preview.decision.alternatives.map((alternative) => ({
        name: alternative.name,
        note: alternative.note,
        storedMastery: recorded.has(alternative.conceptId) ? (recorded.get(alternative.conceptId) ?? null) : null,
      })),
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) return null;
    throw error;
  }
}

type Graph = {
  module: { id: string; name: string; threshold: number; goalName: string };
  concepts: { id: string; name: string }[];
  edges: { conceptId: string; requiresId: string }[];
};

async function loadGraph(instituteId: string, moduleId?: string): Promise<Graph | null> {
  const rows = await db
    .select({
      id: modules.id,
      name: modules.name,
      goalConceptId: modules.goalConceptId,
      threshold: modules.masteryThreshold,
      goalName: concepts.name,
    })
    .from(modules)
    .innerJoin(concepts, eq(concepts.id, modules.goalConceptId))
    .where(moduleId ? and(eq(modules.instituteId, instituteId), eq(modules.id, moduleId)) : eq(modules.instituteId, instituteId))
    .limit(1);
  const moduleRow = rows[0];
  if (!moduleRow) return null;
  const conceptRows = await db
    .select({ id: concepts.id, name: concepts.name })
    .from(moduleConcepts)
    .innerJoin(concepts, eq(concepts.id, moduleConcepts.conceptId))
    .where(eq(moduleConcepts.moduleId, moduleRow.id));
  const conceptIds = conceptRows.map((concept) => concept.id);
  const edges =
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
  return {
    module: {
      id: moduleRow.id,
      name: moduleRow.name,
      threshold: moduleRow.threshold,
      goalName: moduleRow.goalName,
    },
    concepts: conceptRows,
    edges,
  };
}

async function recentAttempts(instituteId: string, studentIds: string[], includeReplay: boolean): Promise<AttemptDashboardRow[]> {
  if (studentIds.length === 0) return [];
  const rows = await db
    .select({
      id: attempts.id,
      sessionId: attempts.sessionId,
      studentName: user.name,
      createdAt: attempts.createdAt,
      statement: questions.statement,
      passRate: attempts.passRate,
      resultJson: attempts.resultJson,
    })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .innerJoin(questions, eq(questions.id, learningSessions.questionId))
    .innerJoin(user, eq(user.id, learningSessions.studentId))
    .where(
      and(
        eq(attempts.instituteId, instituteId),
        eq(attempts.kind, "submit"),
        eq(learningSessions.mode, "graded"),
        inArray(learningSessions.studentId, studentIds),
      ),
    )
    .orderBy(desc(attempts.createdAt))
    .limit(12);
  const attemptIds = rows.map((row) => row.id);
  const explanations = await explanationCounts(attemptIds);
  return rows.map((row) => {
    const counts = hiddenCounts(row.resultJson);
    return {
      id: row.id,
      sessionId: row.sessionId,
      studentName: row.studentName,
      at: formatUtc(row.createdAt),
      statement: row.statement.length > 140 ? `${row.statement.slice(0, 140)}…` : row.statement,
      passRate: row.passRate,
      passed: counts.passed,
      total: counts.total,
      explanation: explanationLabel(explanations.get(row.id) ?? null),
      replayHref: includeReplay ? `/replay/${row.sessionId}` : null,
    };
  });
}

async function explanationCounts(attemptIds: string[]): Promise<Map<string, ExplanationCounts>> {
  const summaries = new Map<string, ExplanationCounts>();
  if (attemptIds.length === 0) return summaries;
  const sets = await db
    .select({ attemptId: explainSets.attemptId, status: explainSets.status })
    .from(explainSets)
    .where(inArray(explainSets.attemptId, attemptIds));
  const answers = await db
    .select({
      attemptId: explainQa.attemptId,
      verdict: explainQa.verdict,
      reviewStatus: explainQa.reviewStatus,
    })
    .from(explainQa)
    .where(inArray(explainQa.attemptId, attemptIds));
  for (const set of sets) {
    const status = set.status === "answered" || set.status === "unavailable" ? set.status : "open";
    summaries.set(set.attemptId, { status, yes: 0, partial: 0, no: 0, needsReview: 0 });
  }
  for (const answer of answers) {
    const summary = summaries.get(answer.attemptId);
    if (!summary) continue;
    if (answer.reviewStatus === "needs_review" || answer.verdict === null) summary.needsReview += 1;
    else if (answer.verdict === "yes") summary.yes += 1;
    else if (answer.verdict === "partial") summary.partial += 1;
    else if (answer.verdict === "no") summary.no += 1;
  }
  return summaries;
}

async function taggedSubmissions(studentId: string, conceptIds: string[]): Promise<Map<string, (number | null)[]>> {
  const grouped = new Map<string, (number | null)[]>();
  if (conceptIds.length === 0) return grouped;
  const rows = await db
    .select({
      conceptId: questionConcepts.conceptId,
      passRate: attempts.passRate,
    })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .innerJoin(questionConcepts, eq(questionConcepts.questionId, learningSessions.questionId))
    .where(
      and(
        eq(learningSessions.studentId, studentId),
        eq(learningSessions.mode, "graded"),
        eq(attempts.kind, "submit"),
        inArray(questionConcepts.conceptId, conceptIds),
      ),
    )
    .orderBy(desc(attempts.createdAt))
    .limit(80);
  for (const row of rows) {
    const list = grouped.get(row.conceptId) ?? [];
    if (list.length >= 4) continue;
    list.push(row.passRate);
    grouped.set(row.conceptId, list);
  }
  return grouped;
}

async function recentRouting(studentId: string): Promise<{ at: string; reason: string }[]> {
  const rows = await db
    .select({ reason: routingDecisions.reason, createdAt: routingDecisions.createdAt })
    .from(routingDecisions)
    .where(eq(routingDecisions.studentId, studentId))
    .orderBy(desc(routingDecisions.createdAt))
    .limit(5);
  return rows.map((row) => ({ at: formatUtc(row.createdAt), reason: row.reason }));
}

async function listAuthorizedBatches(actor: Actor): Promise<{ id: string; name: string; instituteId: string }[]> {
  if (!actor.instituteId) return [];
  if (actor.role === "admin") {
    return db
      .select({ id: batches.id, name: batches.name, instituteId: batches.instituteId })
      .from(batches)
      .where(eq(batches.instituteId, actor.instituteId))
      .orderBy(batches.name);
  }
  return db
    .select({ id: batches.id, name: batches.name, instituteId: batches.instituteId })
    .from(batches)
    .innerJoin(batchTrainers, eq(batchTrainers.batchId, batches.id))
    .where(and(eq(batchTrainers.trainerId, actor.id), eq(batches.instituteId, actor.instituteId)))
    .orderBy(batches.name);
}

function confidenceLabel(confidence: number | undefined): string {
  if (confidence === undefined) return "No mastery record";
  if (confidence === 0) return "Not estimated";
  return confidence.toFixed(2);
}

function hiddenCounts(value: unknown): { passed: number | null; total: number | null } {
  if (!value || typeof value !== "object") return { passed: null, total: null };
  const row = value as Record<string, unknown>;
  return {
    passed: typeof row.passed === "number" ? row.passed : null,
    total: typeof row.total === "number" ? row.total : null,
  };
}

export function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
