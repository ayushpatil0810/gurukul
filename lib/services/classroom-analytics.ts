import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { batchMembers, batchTrainers, classroomEvents, lessons, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { ensureClassroomEventsTable } from "./classroom-telemetry";

export type ClassroomAnalyticsSummary = {
  scope: {
    role: Actor["role"];
    studentId?: string;
    studentName?: string;
    batchId?: string;
    instituteId: string;
  };
  lessons: {
    started: number;
    completed: number;
    completionRate: number;
    recentLessons: {
      lessonId: string;
      lessonTitle: string;
      scenesViewed: number;
      completed: boolean;
      lastActiveAt: string;
    }[];
  };
  scenes: {
    totalViews: number;
    navigationEvents: number;
  };
  labs: {
    totalAttempts: number;
    k8sActions: number;
    k8sRecoveries: number;
    dockerActions: number;
    dockerPassed: number;
    cicdRuns: number;
    cicdPassed: number;
    totalRecoveries: number;
    recoveryRate: number;
  };
  knowledgeChecks: {
    totalAttempts: number;
    correctCount: number;
    accuracyRate: number;
    retriesCount: number;
  };
  mentor: {
    totalOpens: number;
    totalActions: number;
    totalReplies: number;
    fallbackReplies: number;
  };
  sessionContext: {
    totalEvents: number;
    validSessionEvents: number;
    missingOrInvalidSessionEvents: number;
    missingSessionCount: number;
    invalidSessionCount: number;
    crossStudentMismatchCount: number;
  };
  recommendations: {
    viewsCount: number;
    clicksCount: number;
  };
};

export async function getClassroomAnalytics(
  actor: Actor,
  query?: {
    studentId?: string;
    batchId?: string;
    lessonId?: string;
  },
): Promise<ClassroomAnalyticsSummary> {
  const instituteId = actor.instituteId;
  if (!instituteId) {
    throw AppError.forbidden("Account not assigned to an institute");
  }

  await ensureClassroomEventsTable();

  let targetStudentIds: string[] = [];
  let queriedStudentName: string | undefined;

  // 1. Enforce RBAC Trust Boundary
  if (actor.role === "student") {
    // Students can ONLY view their own analytics
    if (query?.studentId && query.studentId !== actor.id) {
      throw AppError.forbidden("Students can only view their own learning analytics");
    }
    targetStudentIds = [actor.id];
    queriedStudentName = actor.name;
  } else if (actor.role === "trainer") {
    // Trainers can only view students and batches they are authorized to manage
    const assignedBatches = await db
      .select({ batchId: batchTrainers.batchId })
      .from(batchTrainers)
      .where(and(eq(batchTrainers.trainerId, actor.id), eq(batchTrainers.instituteId, instituteId)));

    const assignedBatchIds = assignedBatches.map((b) => b.batchId);
    if (assignedBatchIds.length === 0) {
      throw AppError.forbidden("You are not assigned to any batches in this institute");
    }

    if (query?.batchId) {
      if (!assignedBatchIds.includes(query.batchId)) {
        throw AppError.forbidden("You are not assigned to manage this batch");
      }
      const members = await db
        .select({ studentId: batchMembers.studentId })
        .from(batchMembers)
        .where(eq(batchMembers.batchId, query.batchId));
      targetStudentIds = members.map((m) => m.studentId);
    } else if (query?.studentId) {
      // Verify trainer is assigned to a batch containing this student
      const [membership] = await db
        .select({ studentId: batchMembers.studentId })
        .from(batchMembers)
        .where(
          and(
            eq(batchMembers.studentId, query.studentId),
            inArray(batchMembers.batchId, assignedBatchIds),
          ),
        )
        .limit(1);

      if (!membership) {
        throw AppError.forbidden("You are not authorized to view this student's analytics");
      }
      targetStudentIds = [query.studentId];
    } else {
      // All students across trainer's batches
      const members = await db
        .select({ studentId: batchMembers.studentId })
        .from(batchMembers)
        .where(inArray(batchMembers.batchId, assignedBatchIds));
      targetStudentIds = Array.from(new Set(members.map((m) => m.studentId)));
    }
  } else if (actor.role === "admin") {
    // Admins are restricted to their institute boundary
    if (query?.studentId) {
      const [u] = await db
        .select({ id: user.id, instituteId: user.instituteId, name: user.name })
        .from(user)
        .where(eq(user.id, query.studentId))
        .limit(1);
      if (!u || u.instituteId !== instituteId) {
        throw AppError.notFound("Student not found in your institute");
      }
      targetStudentIds = [query.studentId];
      queriedStudentName = u.name;
    } else if (query?.batchId) {
      const members = await db
        .select({ studentId: batchMembers.studentId })
        .from(batchMembers)
        .where(and(eq(batchMembers.batchId, query.batchId), eq(batchMembers.instituteId, instituteId)));
      targetStudentIds = members.map((m) => m.studentId);
    } else {
      // All students in institute
      const students = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.instituteId, instituteId), eq(user.role, "student")));
      targetStudentIds = students.map((s) => s.id);
    }
  }

  if (targetStudentIds.length === 0) {
    return emptySummary(actor.role, instituteId, query?.studentId, query?.batchId, queriedStudentName);
  }

  // 2. Fetch relevant classroom events
  const conditions = [
    eq(classroomEvents.instituteId, instituteId),
    inArray(classroomEvents.studentId, targetStudentIds),
  ];

  if (query?.lessonId) {
    conditions.push(eq(classroomEvents.lessonId, query.lessonId));
  }

  const events = await db
    .select({
      id: classroomEvents.id,
      studentId: classroomEvents.studentId,
      lessonId: classroomEvents.lessonId,
      sessionId: classroomEvents.sessionId,
      sessionValid: classroomEvents.sessionValid,
      invalidReason: classroomEvents.invalidReason,
      type: classroomEvents.type,
      payloadJson: classroomEvents.payloadJson,
      createdAt: classroomEvents.createdAt,
    })
    .from(classroomEvents)
    .where(and(...conditions))
    .orderBy(desc(classroomEvents.createdAt));

  // 3. Compute Metrics
  const startedLessons = new Set<string>();
  const completedLessons = new Set<string>();
  const lessonActivityMap = new Map<
    string,
    { scenesViewed: Set<number>; completed: boolean; lastActive: Date }
  >();

  let sceneViews = 0;
  let navEvents = 0;

  let k8sActions = 0;
  let k8sRecoveries = 0;
  let dockerActions = 0;
  let dockerPassed = 0;
  let cicdRuns = 0;
  let cicdPassed = 0;

  let quizAttempts = 0;
  let quizCorrect = 0;
  let quizRetries = 0;

  let mentorOpens = 0;
  let mentorActions = 0;
  let mentorReplies = 0;
  let mentorFallbacks = 0;

  let recommendationViews = 0;
  let recommendationClicks = 0;

  let validSessions = 0;
  let missingOrInvalidSessions = 0;
  let missingSessionCount = 0;
  let invalidSessionCount = 0;
  let crossStudentMismatchCount = 0;

  for (const event of events) {
    const payload = (event.payloadJson as Record<string, unknown>) ?? {};

    // Session context tracking
    if (event.sessionValid) {
      validSessions++;
    } else {
      missingOrInvalidSessions++;
      if (event.invalidReason === "missing_session_context") {
        missingSessionCount++;
      } else if (event.invalidReason === "cross_student_ownership_mismatch") {
        crossStudentMismatchCount++;
        invalidSessionCount++;
      } else {
        invalidSessionCount++;
      }
    }

    // Lesson tracking
    let act = lessonActivityMap.get(event.lessonId);
    if (!act) {
      act = { scenesViewed: new Set(), completed: false, lastActive: event.createdAt };
      lessonActivityMap.set(event.lessonId, act);
    }
    if (event.createdAt > act.lastActive) {
      act.lastActive = event.createdAt;
    }

    switch (event.type) {
      case "lesson_start":
        startedLessons.add(event.lessonId);
        break;
      case "lesson_complete":
        startedLessons.add(event.lessonId);
        completedLessons.add(event.lessonId);
        act.completed = true;
        break;
      case "scene_view":
        sceneViews++;
        startedLessons.add(event.lessonId);
        if (typeof payload.sceneIndex === "number") {
          act.scenesViewed.add(payload.sceneIndex);
        }
        break;
      case "scene_nav":
        navEvents++;
        break;
      case "k8s_lab_action":
        k8sActions++;
        if (payload.action === "recover" || payload.outcome === "recovered") {
          k8sRecoveries++;
        }
        break;
      case "docker_lab_action":
        dockerActions++;
        if (payload.passed === true || payload.status === "running") {
          dockerPassed++;
        }
        break;
      case "cicd_lab_run":
        cicdRuns++;
        if (payload.passed === true) {
          cicdPassed++;
        }
        break;
      case "quiz_submit":
        quizAttempts++;
        if (payload.isCorrect === true) {
          quizCorrect++;
        }
        break;
      case "quiz_retry":
        quizRetries++;
        break;
      case "mentor_open":
        mentorOpens++;
        break;
      case "mentor_action":
        mentorActions++;
        break;
      case "mentor_reply":
        mentorReplies++;
        if (payload.status === "fallback") {
          mentorFallbacks++;
        }
        break;
      case "recommendation_view":
        recommendationViews++;
        break;
      case "recommendation_click":
        recommendationClicks++;
        break;
    }
  }

  // Load lesson titles for recent lessons
  const lessonIds = Array.from(lessonActivityMap.keys());
  const lessonRows =
    lessonIds.length > 0
      ? await db
          .select({ id: lessons.id, title: lessons.title })
          .from(lessons)
          .where(inArray(lessons.id, lessonIds))
      : [];
  const titleMap = new Map(lessonRows.map((l) => [l.id, l.title]));

  const recentLessons = Array.from(lessonActivityMap.entries())
    .map(([lessonId, data]) => ({
      lessonId,
      lessonTitle: titleMap.get(lessonId) ?? "Interactive Lesson",
      scenesViewed: data.scenesViewed.size,
      completed: data.completed,
      lastActiveAt: data.lastActive.toISOString(),
    }))
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
    .slice(0, 5);

  const totalRecoveries = k8sRecoveries + dockerPassed + cicdPassed;
  const totalLabAttempts = k8sActions + dockerActions + cicdRuns;
  const recoveryRate = totalLabAttempts > 0 ? Number((totalRecoveries / totalLabAttempts).toFixed(2)) : 0;
  const accuracyRate = quizAttempts > 0 ? Number((quizCorrect / quizAttempts).toFixed(2)) : 0;
  const completionRate = startedLessons.size > 0 ? Number((completedLessons.size / startedLessons.size).toFixed(2)) : 0;

  return {
    scope: {
      role: actor.role,
      studentId: query?.studentId ?? (actor.role === "student" ? actor.id : undefined),
      studentName: queriedStudentName,
      batchId: query?.batchId,
      instituteId,
    },
    lessons: {
      started: startedLessons.size,
      completed: completedLessons.size,
      completionRate,
      recentLessons,
    },
    scenes: {
      totalViews: sceneViews,
      navigationEvents: navEvents,
    },
    labs: {
      totalAttempts: totalLabAttempts,
      k8sActions,
      k8sRecoveries,
      dockerActions,
      dockerPassed,
      cicdRuns,
      cicdPassed,
      totalRecoveries,
      recoveryRate,
    },
    knowledgeChecks: {
      totalAttempts: quizAttempts,
      correctCount: quizCorrect,
      accuracyRate,
      retriesCount: quizRetries,
    },
    mentor: {
      totalOpens: mentorOpens,
      totalActions: mentorActions,
      totalReplies: mentorReplies,
      fallbackReplies: mentorFallbacks,
    },
    sessionContext: {
      totalEvents: events.length,
      validSessionEvents: validSessions,
      missingOrInvalidSessionEvents: missingOrInvalidSessions,
      missingSessionCount,
      invalidSessionCount,
      crossStudentMismatchCount,
    },
    recommendations: {
      viewsCount: recommendationViews,
      clicksCount: recommendationClicks,
    },
  };
}

function emptySummary(
  role: Actor["role"],
  instituteId: string,
  studentId?: string,
  batchId?: string,
  studentName?: string,
): ClassroomAnalyticsSummary {
  return {
    scope: {
      role,
      studentId,
      studentName,
      batchId,
      instituteId,
    },
    lessons: { started: 0, completed: 0, completionRate: 0, recentLessons: [] },
    scenes: { totalViews: 0, navigationEvents: 0 },
    labs: {
      totalAttempts: 0,
      k8sActions: 0,
      k8sRecoveries: 0,
      dockerActions: 0,
      dockerPassed: 0,
      cicdRuns: 0,
      cicdPassed: 0,
      totalRecoveries: 0,
      recoveryRate: 0,
    },
    knowledgeChecks: { totalAttempts: 0, correctCount: 0, accuracyRate: 0, retriesCount: 0 },
    mentor: { totalOpens: 0, totalActions: 0, totalReplies: 0, fallbackReplies: 0 },
    sessionContext: {
      totalEvents: 0,
      validSessionEvents: 0,
      missingOrInvalidSessionEvents: 0,
      missingSessionCount: 0,
      invalidSessionCount: 0,
      crossStudentMismatchCount: 0,
    },
    recommendations: {
      viewsCount: 0,
      clicksCount: 0,
    },
  };
}
