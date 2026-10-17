import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assignments,
  attempts,
  batchMembers,
  batchTrainers,
  batches,
  classroomEvents,
  concepts,
  explainQa,
  explainSets,
  learningSessions,
  lessons,
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
import { publishedLessonForConcept } from "@/lib/services/lessons";
import { listReviewQueue } from "@/lib/services/integrity";
import { readStudentForActor } from "@/lib/services/students";
import {
  getAdaptiveRecommendation,
  type AdaptiveActivityType,
  type AdaptivePrerequisiteItem,
  type AdaptiveEvidenceSummary,
} from "@/lib/services/adaptive-loop";

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
  activityType?: AdaptiveActivityType;
  activityTitle?: string;
  actionLabel?: string;
  badgeLabel?: string;
  href?: string | null;
  prerequisites?: AdaptivePrerequisiteItem[];
  evidenceSummary?: AdaptiveEvidenceSummary;
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
  const recommendation = await recommendationFor(actor, studentId, instituteId, moduleId);
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
  actor: Actor,
  studentId: string,
  instituteId: string,
  moduleId: string | undefined,
): Promise<RecommendationView | null> {
  try {
    const adaptive = await getAdaptiveRecommendation(actor, { studentId, moduleId });
    if (!adaptive.recommendation && !adaptive.concept) return null;

    const chosenConceptId = adaptive.concept?.id ?? "";
    const chosenStoredMastery = adaptive.mastery;
    const lesson = await publishedLessonForConcept(instituteId, chosenConceptId);

    return {
      conceptId: chosenConceptId,
      conceptName: adaptive.concept?.name ?? chosenConceptId,
      reason: adaptive.reason,
      storedMastery: chosenStoredMastery,
      predictedSuccess: adaptive.predictedSuccess,
      hasQuestion:
        adaptive.recommendation?.activityType === "practice" ||
        adaptive.alternatives.some((alt) => alt.hasQuestion),
      lesson,
      alternatives: adaptive.alternatives.map((alt) => ({
        name: alt.name,
        note: alt.note,
        storedMastery: alt.storedMastery,
      })),
      activityType: adaptive.recommendation?.activityType,
      activityTitle: adaptive.recommendation?.title,
      actionLabel: adaptive.recommendation?.actionLabel,
      badgeLabel: adaptive.recommendation?.badgeLabel,
      href: adaptive.recommendation?.href,
      prerequisites: adaptive.prerequisites,
      evidenceSummary: adaptive.evidenceSummary,
    };
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 404 || error.statusCode === 403)) return null;
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

function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export type StudentDashboardFullView = {
  student: { id: string; name: string };
  batch: { id: string; name: string } | null;
  module: { id: string; name: string; threshold: number; goalName: string } | null;
  overview: {
    totalConcepts: number;
    masteredConcepts: number;
    developingConcepts: number;
    unassessedConcepts: number;
    courseCompletionRate: number;
    averageMastery: number;
    standingLabel: string;
    bktConfidence: number;
  };
  assignments: {
    totalCount: number;
    completedCount: number;
    completionRate: number;
    passRate: number | null;
    items: {
      id: string;
      title: string;
      mode: string;
      deadline: string | null;
      completed: boolean;
      passRate: number | null;
    }[];
  };
  currentFocus: {
    conceptId: string;
    conceptName: string;
    description: string;
    reason: string;
    storedMastery: number | null;
    predictedSuccess: number | null;
    prerequisites: { id: string; name: string; ready: boolean; storedMastery: number | null }[];
    alternatives: { name: string; note: string; storedMastery: number | null }[];
  } | null;
  nextAction: {
    activityType: string;
    activityTitle: string;
    actionLabel: string;
    badgeLabel: string;
    href: string;
    reason: string;
  } | null;
  concepts: ConceptDashboardRow[];
  roadmapChart: {
    conceptId: string;
    name: string;
    step: number;
    mastery: number;
    threshold: number;
    status: "Mastered" | "In Progress" | "Needs Review" | "Not Started";
    band: MasteryBand;
    confidenceLabel: string;
  }[];
  recommendedLessons: {
    id: string;
    title: string;
    topic: string;
    objectives: string;
    learnerLevel: string;
    durationMinutes: number;
    conceptName: string;
    completed: boolean;
    href: string;
  }[];
  leaderboard: {
    course: {
      studentId: string;
      name: string;
      rank: number;
      score: number;
      masteredCount: number;
      totalConcepts: number;
      isCurrentStudent: boolean;
    }[];
    assignment: {
      studentId: string;
      name: string;
      rank: number;
      score: number;
      submissionsCount: number;
      assertionsPassed: number;
      isCurrentStudent: boolean;
    }[];
    currentStudentRanks: {
      courseRank: number;
      courseTotal: number;
      assignmentRank: number;
      assignmentTotal: number;
    };
  };
  attempts: AttemptDashboardRow[];
  activityFeed: {
    id: string;
    type: "submission" | "lesson" | "routing";
    title: string;
    timestamp: string;
    detail: string;
    badge?: string;
    href?: string;
  }[];
};

export async function readStudentDashboardFullView(
  actor: Actor,
  moduleId?: string,
): Promise<StudentDashboardFullView> {
  if (actor.role !== "student") throw AppError.forbidden("The student dashboard is for students");
  if (!actor.instituteId) throw AppError.forbidden("Your account is not assigned to an institute");

  const instituteId = actor.instituteId;
  const studentId = actor.id;
  const studentName = actor.name;

  // 1. Basic student dashboard data (graph, recommendation, attempts, routing)
  const base = await loadStudentDashboard(actor, studentId, studentName, moduleId, false);
  const graph = await loadGraph(instituteId, moduleId);

  // 2. Resolve Student Batch
  const [batchMembership] = await db
    .select({ id: batches.id, name: batches.name })
    .from(batchMembers)
    .innerJoin(batches, eq(batches.id, batchMembers.batchId))
    .where(and(eq(batchMembers.studentId, studentId), eq(batches.instituteId, instituteId)))
    .limit(1);

  const batchInfo = batchMembership ?? null;

  // 3. Batch Members for Cohort Leaderboard
  const cohortMembers = batchInfo
    ? await db
        .select({ id: user.id, name: user.name })
        .from(batchMembers)
        .innerJoin(user, eq(user.id, batchMembers.studentId))
        .where(eq(batchMembers.batchId, batchInfo.id))
    : [{ id: studentId, name: studentName }];

  const cohortStudentIds = cohortMembers.map((m) => m.id);

  // 4. Course Overview Calculations
  const conceptIds = graph ? graph.concepts.map((c) => c.id) : [];
  let masteredCount = 0;
  let developingCount = 0;
  let unassessedCount = 0;
  let masterySum = 0;
  let assessedCount = 0;

  for (const c of base.concepts) {
    if (c.pKnow === null) {
      unassessedCount++;
    } else {
      assessedCount++;
      masterySum += c.pKnow;
      if (graph && c.pKnow >= graph.module.threshold) {
        masteredCount++;
      } else {
        developingCount++;
      }
    }
  }

  const totalConcepts = base.concepts.length;
  const avgMastery = assessedCount > 0 ? masterySum / assessedCount : 0;
  const courseCompletionRate = totalConcepts > 0 ? masteredCount / totalConcepts : 0;

  let standingLabel = "Not Started";
  if (totalConcepts > 0 && masteredCount === totalConcepts) {
    standingLabel = "Course Mastered";
  } else if (masteredCount > 0) {
    standingLabel = `${masteredCount}/${totalConcepts} Mastered`;
  } else if (assessedCount > 0) {
    standingLabel = "In Progress";
  }

  // 5. Leaderboards (Course Mastery & Assignment Scores)
  // Course Leaderboard
  const allMasteryRows =
    cohortStudentIds.length > 0 && conceptIds.length > 0
      ? await db
          .select({
            studentId: masteryState.studentId,
            pKnow: masteryState.pKnow,
          })
          .from(masteryState)
          .where(
            and(
              inArray(masteryState.studentId, cohortStudentIds),
              inArray(masteryState.conceptId, conceptIds),
            ),
          )
      : [];

  const studentMasteryMap = new Map<string, { sum: number; count: number; mastered: number }>();
  for (const m of cohortMembers) {
    studentMasteryMap.set(m.id, { sum: 0, count: 0, mastered: 0 });
  }

  for (const row of allMasteryRows) {
    const entry = studentMasteryMap.get(row.studentId) ?? { sum: 0, count: 0, mastered: 0 };
    entry.sum += row.pKnow;
    entry.count += 1;
    if (graph && row.pKnow >= graph.module.threshold) {
      entry.mastered += 1;
    }
    studentMasteryMap.set(row.studentId, entry);
  }

  const courseLeaderboardList = cohortMembers
    .map((member) => {
      const stats = studentMasteryMap.get(member.id) ?? { sum: 0, count: 0, mastered: 0 };
      const score = Math.round(stats.sum * 200 + stats.mastered * 100);
      return {
        studentId: member.id,
        name: member.name,
        score,
        masteredCount: stats.mastered,
        totalConcepts,
        isCurrentStudent: member.id === studentId,
      };
    })
    .sort((a, b) => b.score - a.score || b.masteredCount - a.masteredCount);

  const courseLeaderboard = courseLeaderboardList.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  // Assignment Leaderboard
  const allCohortAttempts =
    cohortStudentIds.length > 0
      ? await db
          .select({
            studentId: learningSessions.studentId,
            passRate: attempts.passRate,
            resultJson: attempts.resultJson,
          })
          .from(attempts)
          .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
          .where(
            and(
              inArray(learningSessions.studentId, cohortStudentIds),
              eq(learningSessions.mode, "graded"),
              eq(attempts.kind, "submit"),
            ),
          )
      : [];

  const studentAttemptMap = new Map<
    string,
    { submissions: number; assertionsPassed: number; passRateSum: number }
  >();
  for (const m of cohortMembers) {
    studentAttemptMap.set(m.id, { submissions: 0, assertionsPassed: 0, passRateSum: 0 });
  }

  for (const row of allCohortAttempts) {
    const entry = studentAttemptMap.get(row.studentId) ?? { submissions: 0, assertionsPassed: 0, passRateSum: 0 };
    entry.submissions += 1;
    const counts = hiddenCounts(row.resultJson);
    if (counts.passed !== null) entry.assertionsPassed += counts.passed;
    if (row.passRate !== null) entry.passRateSum += row.passRate;
    studentAttemptMap.set(row.studentId, entry);
  }

  const assignmentLeaderboardList = cohortMembers
    .map((member) => {
      const stats = studentAttemptMap.get(member.id) ?? { submissions: 0, assertionsPassed: 0, passRateSum: 0 };
      const avgRate = stats.submissions > 0 ? stats.passRateSum / stats.submissions : 0;
      const score = stats.assertionsPassed * 25 + Math.round(avgRate * 500) + stats.submissions * 20;
      return {
        studentId: member.id,
        name: member.name,
        score,
        submissionsCount: stats.submissions,
        assertionsPassed: stats.assertionsPassed,
        isCurrentStudent: member.id === studentId,
      };
    })
    .sort((a, b) => b.score - a.score || b.assertionsPassed - a.assertionsPassed);

  const assignmentLeaderboard = assignmentLeaderboardList.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  const currentCourseRank = courseLeaderboard.find((c) => c.isCurrentStudent)?.rank ?? 1;
  const currentAssignmentRank = assignmentLeaderboard.find((a) => a.isCurrentStudent)?.rank ?? 1;

  // 6. Assignments & Tasks Tracking
  const rawBatchAssignments = batchInfo
    ? await db
        .select({
          id: assignments.id,
          moduleId: assignments.moduleId,
          deadline: assignments.deadline,
          mode: assignments.mode,
          attemptLimit: assignments.attemptLimit,
          moduleName: modules.name,
        })
        .from(assignments)
        .innerJoin(modules, eq(modules.id, assignments.moduleId))
        .where(eq(assignments.batchId, batchInfo.id))
    : [];

  type AssignmentItem = StudentDashboardFullView["assignments"]["items"][number];
  let assignmentItems: AssignmentItem[] = [];

  if (rawBatchAssignments.length > 0) {
    // If explicit assignments exist in assignments table
    for (const a of rawBatchAssignments) {
      // Check if student has graded attempts for this module's questions
      const hasPassingAttempt = base.attempts.some(
        (att) => att.passRate !== null && att.passRate >= 0.8,
      );
      const latestAttempt = base.attempts[0];
      assignmentItems.push({
        id: a.id,
        title: `${a.moduleName} (${a.mode === "graded" ? "Graded Assessment" : "Practice Lab"})`,
        mode: a.mode,
        deadline: a.deadline ? formatUtc(a.deadline) : null,
        completed: hasPassingAttempt,
        passRate: latestAttempt?.passRate ?? null,
      });
    }
  } else if (conceptIds.length > 0) {
    // Fallback: evaluate questions in the current module as assignment milestones
    const moduleQuestions = await db
      .select({
        id: questions.id,
        statement: questions.statement,
        difficulty: questions.difficulty,
      })
      .from(questions)
      .innerJoin(questionConcepts, eq(questionConcepts.questionId, questions.id))
      .where(
        and(
          eq(questions.instituteId, instituteId),
          eq(questions.status, "published"),
          inArray(questionConcepts.conceptId, conceptIds),
        ),
      )
      .limit(6);

    const seenQIds = new Set<string>();
    for (const q of moduleQuestions) {
      if (seenQIds.has(q.id)) continue;
      seenQIds.add(q.id);

      const matchingAttempt = base.attempts.find(
        (att) => att.statement.includes(q.statement.slice(0, 40)),
      );

      assignmentItems.push({
        id: q.id,
        title: q.statement.length > 70 ? `${q.statement.slice(0, 70)}…` : q.statement,
        mode: "graded",
        deadline: null,
        completed: matchingAttempt ? (matchingAttempt.passRate ?? 0) >= 0.8 : false,
        passRate: matchingAttempt?.passRate ?? null,
      });
    }
  }

  const completedAssignmentsCount = assignmentItems.filter((item) => item.completed).length;
  const assignmentCompletionRate =
    assignmentItems.length > 0 ? completedAssignmentsCount / assignmentItems.length : 0;

  // 7. Recommended Published Lessons
  const publishedLessons =
    conceptIds.length > 0
      ? await db
          .select({
            id: lessons.id,
            title: lessons.title,
            topic: lessons.topic,
            objectives: lessons.objectives,
            learnerLevel: lessons.learnerLevel,
            durationMinutes: lessons.durationMinutes,
            conceptId: lessons.conceptId,
          })
          .from(lessons)
          .where(
            and(
              eq(lessons.instituteId, instituteId),
              eq(lessons.status, "published"),
              inArray(lessons.conceptId, conceptIds),
            ),
          )
          .limit(4)
      : [];

  const completedLessonRows = await db
    .select({ lessonId: classroomEvents.lessonId })
    .from(classroomEvents)
    .where(
      and(
        eq(classroomEvents.studentId, studentId),
        eq(classroomEvents.type, "lesson_complete"),
      ),
    );
  const completedLessonIds = new Set(completedLessonRows.map((r) => r.lessonId));

  const conceptNameMap = new Map(graph ? graph.concepts.map((c) => [c.id, c.name]) : []);
  const recommendedLessons = publishedLessons.map((l) => ({
    id: l.id,
    title: l.title,
    topic: l.topic,
    objectives: l.objectives,
    learnerLevel: l.learnerLevel,
    durationMinutes: l.durationMinutes,
    conceptName: conceptNameMap.get(l.conceptId) ?? "Core Concept",
    completed: completedLessonIds.has(l.id),
    href: `/learn/${l.id}`,
  }));

  // 8. Roadmap Chart Data (Topological Sequence)
  const orderedIds = graph ? orderByPrerequisite(conceptIds, graph.edges) : [];
  const recConceptId = base.recommendation?.conceptId;

  const roadmapChart = orderedIds.map((id, index) => {
    const conceptRow = base.concepts.find((c) => c.id === id);
    const pKnow = conceptRow?.pKnow ?? null;
    const threshold = graph?.module.threshold ?? 0.8;
    const masteryPercent = Math.round((pKnow ?? 0) * 100);
    const thresholdPercent = Math.round(threshold * 100);

    let status: StudentDashboardFullView["roadmapChart"][number]["status"] = "Not Started";
    if (pKnow !== null && pKnow >= threshold) {
      status = "Mastered";
    } else if (pKnow !== null && pKnow > 0) {
      status = pKnow >= 0.5 ? "In Progress" : "Needs Review";
    } else if (id === recConceptId) {
      status = "In Progress";
    }

    return {
      conceptId: id,
      name: conceptNameMap.get(id) ?? id,
      step: index + 1,
      mastery: masteryPercent,
      threshold: thresholdPercent,
      status,
      band: conceptRow?.band ?? "not_recorded",
      confidenceLabel: conceptRow?.confidenceLabel ?? "Not estimated",
    };
  });

  // 9. Current Focus & Next Steps
  const rec = base.recommendation;
  const currentFocus = rec
    ? {
        conceptId: rec.conceptId,
        conceptName: rec.conceptName,
        description: graph?.concepts.find((c) => c.id === rec.conceptId)?.name ?? "",
        reason: rec.reason,
        storedMastery: rec.storedMastery,
        predictedSuccess: rec.predictedSuccess,
        prerequisites: (rec.prerequisites ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          ready: p.ready,
          storedMastery: p.storedMastery,
        })),
        alternatives: rec.alternatives,
      }
    : null;

  const nextAction = rec
    ? {
        activityType: rec.activityType ?? "practice",
        activityTitle: rec.activityTitle ?? `Master ${rec.conceptName}`,
        actionLabel: rec.actionLabel ?? "Continue Learning",
        badgeLabel: rec.badgeLabel ?? "Recommended Next Step",
        href: rec.href ?? (rec.lesson ? `/learn/${rec.lesson.id}` : "/practice"),
        reason: rec.reason,
      }
    : null;

  // 10. Unified Activity Feed
  type FeedItem = StudentDashboardFullView["activityFeed"][number];
  const feed: FeedItem[] = [];

  for (const att of base.attempts.slice(0, 5)) {
    feed.push({
      id: `att-${att.id}`,
      type: "submission",
      title: att.statement,
      timestamp: att.at,
      detail:
        att.passed !== null && att.total !== null
          ? `${att.passed}/${att.total} hidden tests passed (${Math.round((att.passRate ?? 0) * 100)}%)`
          : "Graded solution evaluated",
      badge: att.passRate !== null && att.passRate >= 0.8 ? "Passed" : "Needs Fix",
      href: att.replayHref ?? undefined,
    });
  }

  // Fetch recent lesson activities from classroomEvents
  const recentClassEvents = await db
    .select({
      id: classroomEvents.id,
      type: classroomEvents.type,
      createdAt: classroomEvents.createdAt,
      lessonTitle: lessons.title,
    })
    .from(classroomEvents)
    .innerJoin(lessons, eq(lessons.id, classroomEvents.lessonId))
    .where(eq(classroomEvents.studentId, studentId))
    .orderBy(desc(classroomEvents.createdAt))
    .limit(4);

  for (const ev of recentClassEvents) {
    const isDone = ev.type === "lesson_complete";
    feed.push({
      id: `ev-${ev.id}`,
      type: "lesson",
      title: ev.lessonTitle,
      timestamp: formatUtc(ev.createdAt),
      detail: isDone ? "Completed full interactive lesson" : "Progressed through interactive simulation",
      badge: isDone ? "Completed" : "Engaged",
    });
  }

  for (const r of base.routing.slice(0, 3)) {
    feed.push({
      id: `route-${r.at}-${r.reason.slice(0, 20)}`,
      type: "routing",
      title: "Adaptive Calibration Update",
      timestamp: r.at,
      detail: r.reason,
      badge: "Selector",
    });
  }

  // Sort feed descending by timestamp
  feed.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return {
    student: { id: studentId, name: studentName },
    batch: batchInfo,
    module: base.module,
    overview: {
      totalConcepts,
      masteredConcepts: masteredCount,
      developingConcepts: developingCount,
      unassessedConcepts: unassessedCount,
      courseCompletionRate,
      averageMastery: avgMastery,
      standingLabel,
      bktConfidence: 0.85,
    },
    assignments: {
      totalCount: assignmentItems.length,
      completedCount: completedAssignmentsCount,
      completionRate: assignmentCompletionRate,
      passRate: base.attempts[0]?.passRate ?? null,
      items: assignmentItems,
    },
    currentFocus,
    nextAction,
    concepts: base.concepts,
    roadmapChart,
    recommendedLessons,
    leaderboard: {
      course: courseLeaderboard,
      assignment: assignmentLeaderboard,
      currentStudentRanks: {
        courseRank: currentCourseRank,
        courseTotal: courseLeaderboard.length,
        assignmentRank: currentAssignmentRank,
        assignmentTotal: assignmentLeaderboard.length,
      },
    },
    attempts: base.attempts,
    activityFeed: feed.slice(0, 10),
  };
}
