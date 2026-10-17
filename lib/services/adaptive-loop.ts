import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  classroomEvents,
  concepts,
  learningSessions,
  masteryState,
  moduleConcepts,
  modules,
  prerequisites,
  questionConcepts,
  questions,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { DEFAULT_BKT_PARAMS } from "@/lib/engine/bkt";
import { selectNextQuestion, type SelectorDecision } from "@/lib/engine/selector";
import { publishedLessonForConcept } from "@/lib/services/lessons";
import { readStudentForActor } from "@/lib/services/students";

export type AdaptiveActivityType =
  | "lesson"
  | "practice"
  | "prerequisite_remediation"
  | "module_complete"
  | "none";

export type AdaptivePrerequisiteItem = {
  id: string;
  name: string;
  ready: boolean;
  storedMastery: number | null;
  requiredThreshold: number;
};

export type AdaptiveEvidenceSummary = {
  totalAttempts: number;
  gradedAttempts: number;
  assessmentsPassed: number;
  lastAttemptAt: string | null;
  lessonsCompleted: number;
  telemetryEventsCount: number;
};

export type AdaptiveAlternativeItem = {
  conceptId: string;
  name: string;
  note: string;
  storedMastery: number | null;
  ready: boolean;
  hasQuestion: boolean;
  lesson: { id: string; title: string } | null;
};

export type AdaptiveRecommendationResult = {
  recommendation: {
    activityType: AdaptiveActivityType;
    activityId: string | null;
    title: string;
    href: string | null;
    actionLabel: string;
    badgeLabel: string;
  } | null;
  reason: string;
  concept: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  mastery: number | null;
  predictedSuccess: number | null;
  prerequisites: AdaptivePrerequisiteItem[];
  evidenceSummary: AdaptiveEvidenceSummary;
  alternatives: AdaptiveAlternativeItem[];
  module: {
    id: string;
    name: string;
    threshold: number;
    goalName: string;
  } | null;
};

export async function getAdaptiveRecommendation(
  actor: Actor,
  query?: { studentId?: string; moduleId?: string },
): Promise<AdaptiveRecommendationResult> {
  const instituteId = actor.instituteId;
  if (!instituteId) {
    throw AppError.forbidden("Account not assigned to an institute");
  }

  // 1. Resolve & authorize target student
  let targetStudentId = actor.id;

  if (actor.role === "student") {
    if (query?.studentId && query.studentId !== actor.id) {
      throw AppError.forbidden("Students can only view their own learning recommendations");
    }
    targetStudentId = actor.id;
  } else if (actor.role === "trainer" || actor.role === "admin") {
    if (query?.studentId) {
      const student = await readStudentForActor(actor, query.studentId);
      targetStudentId = student.id;
    } else {
      // If trainer or admin queries without studentId, return empty/baseline
      throw AppError.badRequest("Please specify studentId when querying recommendations as trainer/admin");
    }
  } else {
    throw AppError.forbidden("Access denied");
  }

  // 2. Load module and concept DAG
  const moduleRow = await loadModuleGraph(instituteId, query?.moduleId);
  if (!moduleRow) {
    return emptyRecommendation("No learning module is currently available for this institute.");
  }

  const { moduleInfo, concepts: conceptList, edges } = moduleRow;
  if (conceptList.length === 0) {
    return emptyRecommendation("No concepts are configured for this module.");
  }

  const conceptIds = conceptList.map((c) => c.id);
  const conceptMap = new Map(conceptList.map((c) => [c.id, c]));

  // 3. Load authoritative stored mastery (keep missing as undefined/null!)
  const masteryRows = await db
    .select({
      conceptId: masteryState.conceptId,
      pKnow: masteryState.pKnow,
    })
    .from(masteryState)
    .where(
      and(
        eq(masteryState.studentId, targetStudentId),
        inArray(masteryState.conceptId, conceptIds),
      ),
    );

  const storedMasteryMap = new Map<string, number>();
  for (const row of masteryRows) {
    storedMasteryMap.set(row.conceptId, row.pKnow);
  }

  // 4. Map direct prerequisites
  const prereqMap = new Map<string, string[]>();
  for (const edge of edges) {
    const list = prereqMap.get(edge.conceptId) ?? [];
    list.push(edge.requiresId);
    prereqMap.set(edge.conceptId, list);
  }

  // Helper: a concept is ready if ALL its prerequisites have stored mastery >= threshold
  const isReady = (conceptId: string) => {
    const reqs = prereqMap.get(conceptId) ?? [];
    return reqs.every((reqId) => {
      const m = storedMasteryMap.get(reqId);
      return m !== undefined && m >= moduleInfo.threshold;
    });
  };

  // 5. Load questions and attempted questions
  const questionRows = await db
    .select({
      id: questions.id,
      conceptId: questionConcepts.conceptId,
      difficulty: questions.difficulty,
    })
    .from(questionConcepts)
    .innerJoin(questions, eq(questions.id, questionConcepts.questionId))
    .where(
      and(
        eq(questions.instituteId, instituteId),
        eq(questions.status, "published"),
        inArray(questionConcepts.conceptId, conceptIds),
      ),
    );

  const attemptedRows = await db
    .select({ questionId: learningSessions.questionId })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .where(
      and(
        eq(learningSessions.studentId, targetStudentId),
        eq(attempts.kind, "submit"),
      ),
    );

  const attemptedQuestionIds = attemptedRows.map((a) => a.questionId);

  // 6. Execute deterministic selector
  const decision: SelectorDecision = selectNextQuestion({
    goalId: moduleInfo.goalConceptId,
    concepts: conceptList.map((c) => ({ id: c.id, name: c.name })),
    edges,
    mastery: Object.fromEntries(storedMasteryMap.entries()),
    threshold: moduleInfo.threshold,
    questions: questionRows,
    attemptedQuestionIds,
    params: conceptList[0]?.params ?? DEFAULT_BKT_PARAMS,
  });

  const chosenConceptId = decision.conceptId;
  const chosenConcept = conceptMap.get(chosenConceptId);
  const chosenStoredMastery = storedMasteryMap.get(chosenConceptId) ?? null;

  // 7. Check prerequisite readiness details for the chosen concept
  const directReqIds = prereqMap.get(chosenConceptId) ?? [];
  const prerequisitesDetails: AdaptivePrerequisiteItem[] = directReqIds.map((reqId) => {
    const prereqConcept = conceptMap.get(reqId);
    const m = storedMasteryMap.get(reqId) ?? null;
    return {
      id: reqId,
      name: prereqConcept?.name ?? reqId,
      ready: m !== null && m >= moduleInfo.threshold,
      storedMastery: m,
      requiredThreshold: moduleInfo.threshold,
    };
  });

  const hasUnmetPrereq = prerequisitesDetails.some((p) => !p.ready);

  // 8. Check published lessons for chosen concept and prerequisites
  const publishedLesson = await publishedLessonForConcept(instituteId, chosenConceptId);

  // 9. Determine evidence summary
  const evidenceSummary = await loadEvidenceSummary(targetStudentId, instituteId);

  // 10. Formulate recommendation activity, link, and reason
  let activityType: AdaptiveActivityType = "none";
  let activityId: string | null = null;
  let title = "No Recommended Activity";
  let href: string | null = null;
  let actionLabel = "Review Dashboard";
  let badgeLabel = "Status";
  let reason = decision.reason;

  const allPrereqsMastered = conceptIds
    .filter((id) => id !== moduleInfo.goalConceptId)
    .every((id) => (storedMasteryMap.get(id) ?? 0) >= moduleInfo.threshold);
  const goalMastered = (storedMasteryMap.get(moduleInfo.goalConceptId) ?? 0) >= moduleInfo.threshold;

  if (allPrereqsMastered && goalMastered && chosenConceptId === moduleInfo.goalConceptId) {
    activityType = "module_complete";
    title = `Module Goal Achieved: ${moduleInfo.goalName}`;
    actionLabel = "Module Complete";
    badgeLabel = "Goal Mastered";
    href = null;
    reason = `Congratulations! You have demonstrated solid mastery across all concepts in ${moduleInfo.name} (at or above ${Math.round(moduleInfo.threshold * 100)}%).`;
  } else if (hasUnmetPrereq) {
    // A prerequisite is blocking this concept
    const blockingPrereq = prerequisitesDetails.find((p) => !p.ready)!;
    activityType = "prerequisite_remediation";
    badgeLabel = "Prerequisite Review";

    const prereqLesson = await publishedLessonForConcept(instituteId, blockingPrereq.id);
    if (prereqLesson) {
      activityId = prereqLesson.id;
      title = `Review Prerequisite: ${prereqLesson.title}`;
      href = `/learn/${prereqLesson.id}?from=recommendation`;
      actionLabel = "Open Prerequisite Lesson";
    } else {
      activityId = decision.questionId;
      title = `Practice Prerequisite: ${blockingPrereq.name}`;
      href = decision.questionId ? `/practice?questionId=${decision.questionId}` : "/practice";
      actionLabel = "Start Prerequisite Practice";
    }

    const prereqScoreText =
      blockingPrereq.storedMastery !== null
        ? `${Math.round(blockingPrereq.storedMastery * 100)}%`
        : "not recorded";
    reason = `Review ${blockingPrereq.name} first. Your recorded mastery (${prereqScoreText}) is below the ${Math.round(moduleInfo.threshold * 100)}% threshold required for ${chosenConcept?.name ?? "the next concept"}.`;
  } else if (publishedLesson && evidenceSummary.lessonsCompleted === 0) {
    // If student has not completed the introductory lesson for this concept
    activityType = "lesson";
    activityId = publishedLesson.id;
    title = `Interactive Lesson: ${publishedLesson.title}`;
    href = `/learn/${publishedLesson.id}?from=recommendation`;
    actionLabel = "Start Interactive Lesson";
    badgeLabel = "Interactive Lesson";

    if (chosenStoredMastery === null) {
      reason = `Your mastery has not been recorded for ${chosenConcept?.name ?? "this concept"} yet. Start with the interactive lesson “${publishedLesson.title}” to build foundational knowledge.`;
    } else {
      reason = `Continue learning ${chosenConcept?.name ?? "this concept"}. Your current recorded mastery is ${Math.round(chosenStoredMastery * 100)}%, and this interactive lesson covers core DevOps principles.`;
    }
  } else if (decision.questionId) {
    // Practice coding question
    activityType = "practice";
    activityId = decision.questionId;
    title = `Practice Challenge: ${chosenConcept?.name ?? "Coding Question"}`;
    href = `/practice?questionId=${decision.questionId}`;
    actionLabel = "Start Coding Practice";
    badgeLabel = "Coding Practice";

    const predictedPercent = Math.round((decision.predictedSuccess ?? 0.7) * 100);
    if (chosenStoredMastery === null) {
      reason = `Practice ${chosenConcept?.name ?? "this concept"}. Prerequisites are satisfied, and this challenge is calibrated to approximately ${predictedPercent}% predicted success.`;
    } else {
      reason = `Reinforce your understanding of ${chosenConcept?.name ?? "this concept"}. Your recorded mastery is ${Math.round(chosenStoredMastery * 100)}%, targeting ${predictedPercent}% predicted success on this question.`;
    }
  } else if (publishedLesson) {
    // Fallback to published lesson if no question is available
    activityType = "lesson";
    activityId = publishedLesson.id;
    title = `Interactive Lesson: ${publishedLesson.title}`;
    href = `/learn/${publishedLesson.id}?from=recommendation`;
    actionLabel = "Start Interactive Lesson";
    badgeLabel = "Interactive Lesson";
    reason = `Explore ${chosenConcept?.name ?? "this concept"} with the published interactive lesson “${publishedLesson.title}”.`;
  } else {
    activityType = "none";
    title = `No Activity Available for ${chosenConcept?.name ?? "Concept"}`;
    href = null;
    actionLabel = "Check Back Soon";
    badgeLabel = "Awaiting Content";
    reason = `Prerequisites are ready for ${chosenConcept?.name ?? "this concept"}, but no published lesson or practice question is currently active.`;
  }

  // 11. Alternatives list with published lesson check
  const alternatives: AdaptiveAlternativeItem[] = await Promise.all(
    decision.alternatives.map(async (alt) => {
      const storedM = storedMasteryMap.get(alt.conceptId) ?? null;
      const lesson = await publishedLessonForConcept(instituteId, alt.conceptId);
      const hasQ = questionRows.some((q) => q.conceptId === alt.conceptId);
      return {
        conceptId: alt.conceptId,
        name: alt.name,
        note: alt.note,
        storedMastery: storedM,
        ready: isReady(alt.conceptId),
        hasQuestion: hasQ,
        lesson,
      };
    }),
  );

  return {
    recommendation: {
      activityType,
      activityId,
      title,
      href,
      actionLabel,
      badgeLabel,
    },
    reason,
    concept: chosenConcept
      ? {
          id: chosenConcept.id,
          name: chosenConcept.name,
          description: chosenConcept.description ?? null,
        }
      : null,
    mastery: chosenStoredMastery,
    predictedSuccess: decision.predictedSuccess,
    prerequisites: prerequisitesDetails,
    evidenceSummary,
    alternatives,
    module: moduleInfo,
  };
}

async function loadEvidenceSummary(studentId: string, instituteId: string): Promise<AdaptiveEvidenceSummary> {
  const attemptRows = await db
    .select({
      id: attempts.id,
      kind: attempts.kind,
      passRate: attempts.passRate,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .where(
      and(
        eq(learningSessions.studentId, studentId),
        eq(learningSessions.instituteId, instituteId),
      ),
    )
    .orderBy(desc(attempts.createdAt));

  const totalAttempts = attemptRows.length;
  const gradedAttempts = attemptRows.filter((a) => a.kind === "submit").length;
  const assessmentsPassed = attemptRows.filter((a) => a.kind === "submit" && (a.passRate ?? 0) >= 1).length;
  const lastAttemptAt = attemptRows[0]?.createdAt ? attemptRows[0].createdAt.toISOString() : null;

  let lessonsCompleted = 0;
  let telemetryEventsCount = 0;

  try {
    const [compRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classroomEvents)
      .where(
        and(
          eq(classroomEvents.studentId, studentId),
          eq(classroomEvents.instituteId, instituteId),
          eq(classroomEvents.type, "lesson_complete"),
        ),
      );
    lessonsCompleted = compRow?.count ?? 0;

    const [eventRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classroomEvents)
      .where(
        and(
          eq(classroomEvents.studentId, studentId),
          eq(classroomEvents.instituteId, instituteId),
        ),
      );
    telemetryEventsCount = eventRow?.count ?? 0;
  } catch {
    // classroomEvents table might not have events yet
  }

  return {
    totalAttempts,
    gradedAttempts,
    assessmentsPassed,
    lastAttemptAt,
    lessonsCompleted,
    telemetryEventsCount,
  };
}

async function loadModuleGraph(instituteId: string, moduleId?: string) {
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
    .where(
      moduleId
        ? and(eq(modules.instituteId, instituteId), eq(modules.id, moduleId))
        : eq(modules.instituteId, instituteId),
    )
    .limit(1);

  const moduleRow = rows[0];
  if (!moduleRow) return null;

  const conceptRows = await db
    .select({
      id: concepts.id,
      name: concepts.name,
      description: concepts.description,
      params: concepts.bktParamsJson,
    })
    .from(moduleConcepts)
    .innerJoin(concepts, eq(concepts.id, moduleConcepts.conceptId))
    .where(eq(moduleConcepts.moduleId, moduleRow.id));

  const conceptIds = conceptRows.map((c) => c.id);
  const edges =
    conceptIds.length === 0
      ? []
      : await db
          .select({
            conceptId: prerequisites.conceptId,
            requiresId: prerequisites.requiresId,
          })
          .from(prerequisites)
          .where(
            and(
              eq(prerequisites.instituteId, instituteId),
              inArray(prerequisites.conceptId, conceptIds),
              inArray(prerequisites.requiresId, conceptIds),
            ),
          );

  return {
    moduleInfo: moduleRow,
    concepts: conceptRows,
    edges,
  };
}

function emptyRecommendation(reason: string): AdaptiveRecommendationResult {
  return {
    recommendation: null,
    reason,
    concept: null,
    mastery: null,
    predictedSuccess: null,
    prerequisites: [],
    evidenceSummary: {
      totalAttempts: 0,
      gradedAttempts: 0,
      assessmentsPassed: 0,
      lastAttemptAt: null,
      lessonsCompleted: 0,
      telemetryEventsCount: 0,
    },
    alternatives: [],
    module: null,
  };
}
