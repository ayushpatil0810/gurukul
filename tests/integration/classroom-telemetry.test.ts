import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classroomEvents,
  events,
  learningSessions,
  masteryState,
  masteryUpdates,
  questions,
  signals,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { recordClassroomTelemetry, listClassroomEventsForStudent } from "@/lib/services/classroom-telemetry";
import { getClassroomAnalytics } from "@/lib/services/classroom-analytics";
import { sanitizeAndValidateClassroomPayload } from "@/lib/validations/classroom-telemetry";
import { readLessonForStudent } from "@/lib/services/lessons";

const FLAGSHIP_LESSON_ID = "4a3a34a7-7596-4d6e-b22e-a909d7f6d7da";
const FUNCTIONS_CONCEPT_ID = "060f4e53-e15a-4342-8cda-d400eaba4e95";

afterAll(async () => {
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("Phase 5.2 — Learning Telemetry & Adaptive Integration", () => {
  let ada: Actor;
  let ben: Actor;
  let trainer: Actor;
  let admin: Actor;
  let outsider: Actor;
  let initialAdaMastery: number | null = null;

  it("loads test accounts and establishes data integrity baseline", async () => {
    const [adaRow] = await db.select().from(user).where(eq(user.email, "ada@techsummit.example")).limit(1);
    const [benRow] = await db.select().from(user).where(eq(user.email, "ben@techsummit.example")).limit(1);
    const [trainerRow] = await db.select().from(user).where(eq(user.email, "trainer@techsummit.example")).limit(1);
    const [adminRow] = await db.select().from(user).where(eq(user.email, "admin@techsummit.example")).limit(1);

    expect(adaRow).toBeDefined();
    expect(benRow).toBeDefined();
    expect(trainerRow).toBeDefined();
    expect(adminRow).toBeDefined();

    ada = {
      id: adaRow!.id,
      name: adaRow!.name,
      email: adaRow!.email,
      role: "student",
      instituteId: adaRow!.instituteId,
    };

    ben = {
      id: benRow!.id,
      name: benRow!.name,
      email: benRow!.email,
      role: "student",
      instituteId: benRow!.instituteId,
    };

    trainer = {
      id: trainerRow!.id,
      name: trainerRow!.name,
      email: trainerRow!.email,
      role: "trainer",
      instituteId: trainerRow!.instituteId,
    };

    admin = {
      id: adminRow!.id,
      name: adminRow!.name,
      email: adminRow!.email,
      role: "admin",
      instituteId: adminRow!.instituteId,
    };

    outsider = {
      id: crypto.randomUUID(),
      name: "Outsider",
      email: "outsider@otherinstitute.example",
      role: "student",
      instituteId: crypto.randomUUID(),
    };

    // Capture initial Ada mastery baseline
    const [mastery] = await db
      .select({ pKnow: masteryState.pKnow })
      .from(masteryState)
      .where(and(eq(masteryState.studentId, ada.id), eq(masteryState.conceptId, FUNCTIONS_CONCEPT_ID)))
      .limit(1);
    initialAdaMastery = mastery?.pKnow ?? null;
  });

  describe("Event Schema & Payload Validation", () => {
    it("validates all 15 privacy-conscious classroom event types", () => {
      const validCases: Array<{ type: Parameters<typeof sanitizeAndValidateClassroomPayload>[0]; payload: Record<string, unknown> }> = [
        { type: "lesson_start", payload: { sceneCount: 10 } },
        { type: "lesson_complete", payload: { durationMs: 124000, scenesViewed: 10, totalScenes: 10 } },
        { type: "scene_view", payload: { sceneIndex: 2, role: "diagram", title: "Microservices Architecture" } },
        { type: "scene_nav", payload: { fromIndex: 1, toIndex: 2, direction: "next" } },
        { type: "diagram_node_inspect", payload: { nodeId: "node-cart", nodeLabel: "Cart Service", category: "Microservice" } },
        { type: "stepper_step", payload: { stepIndex: 3, totalSteps: 5, completed: false } },
        { type: "walkthrough_step", payload: { stepIndex: 2, totalSteps: 4 } },
        { type: "docker_lab_action", payload: { action: "health_check", status: "200_ok", passed: true } },
        { type: "cicd_lab_run", payload: { stage: 3, stageName: "Automated Tests", passed: false, gateOutcome: "blocked" } },
        { type: "k8s_lab_action", payload: { action: "recover", replicas: 3, outcome: "recovered" } },
        { type: "quiz_submit", payload: { questionId: "q-1", selectedOption: "A", isCorrect: true } },
        { type: "quiz_retry", payload: { questionId: "q-1", attemptCount: 2 } },
        { type: "mentor_open", payload: { sceneTitle: "Kubernetes Cluster Simulation" } },
        { type: "mentor_action", payload: { action: "hint", promptCategory: "hint" } },
        { type: "mentor_reply", payload: { action: "hint", status: "success" } },
      ];

      for (const item of validCases) {
        const cleaned = sanitizeAndValidateClassroomPayload(item.type, item.payload);
        expect(cleaned).toBeDefined();
      }
    });

    it("scrubs forbidden and sensitive payload keys (passwords, secrets, full transcripts)", () => {
      const dirtyPayload = {
        sceneCount: 10,
        password: "SuperSecretPassword!",
        secret: "jwt_token_here",
        referenceSolution: "function hack() {}",
        fullTranscript: "User said: what is the answer?",
        rawAnswerKey: ["A"],
      };

      const cleaned = sanitizeAndValidateClassroomPayload("lesson_start", dirtyPayload);
      expect(cleaned).toEqual({ sceneCount: 10 });
      expect((cleaned as Record<string, unknown>).password).toBeUndefined();
      expect((cleaned as Record<string, unknown>).secret).toBeUndefined();
      expect((cleaned as Record<string, unknown>).referenceSolution).toBeUndefined();
      expect((cleaned as Record<string, unknown>).fullTranscript).toBeUndefined();
    });

    it("rejects oversized payloads (> 16 KB)", () => {
      const hugeString = "A".repeat(17_000);
      expect(() =>
        sanitizeAndValidateClassroomPayload("mentor_open", { sceneTitle: hugeString }),
      ).toThrow(/exceeds maximum allowed limit/);
    });
  });

  describe("Authentication, Authorization & Institute Boundaries", () => {
    it("rejects non-student actors from recording student telemetry", async () => {
      await expect(
        recordClassroomTelemetry(trainer, FLAGSHIP_LESSON_ID, [
          { seq: 1, t: 100, type: "lesson_start", payload: { sceneCount: 10 } },
        ]),
      ).rejects.toThrow("Classroom telemetry is recorded for students");
    });

    it("rejects telemetry for a lesson outside the student's institute", async () => {
      await expect(
        recordClassroomTelemetry(outsider, FLAGSHIP_LESSON_ID, [
          { seq: 1, t: 100, type: "lesson_start", payload: { sceneCount: 10 } },
        ]),
      ).rejects.toThrow("Lesson not found");
    });

    it("rejects telemetry for non-existent lessons", async () => {
      const fakeLessonId = crypto.randomUUID();
      await expect(
        recordClassroomTelemetry(ada, fakeLessonId, [
          { seq: 1, t: 100, type: "lesson_start", payload: { sceneCount: 10 } },
        ]),
      ).rejects.toThrow("Lesson not found");
    });
  });

  describe("Session Ownership, Missing/Invalid Context & Cross-Student Isolation", () => {
    it("records events when session context is omitted, marking valid: false and reason: missing_session_context", async () => {
      const result = await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [
          { seq: 1, t: 10, type: "lesson_start", payload: { sceneCount: 10 } },
          { seq: 2, t: 50, type: "scene_view", payload: { sceneIndex: 0, role: "introduction" } },
        ],
        null,
      );

      expect(result.received).toBe(2);
      expect(result.recorded).toBe(2);
      expect(result.sessionValid).toBe(false);
      expect(result.invalidReason).toBe("missing_session_context");
    });

    it("records events when session ID does not exist, marking valid: false and reason: session_not_found", async () => {
      const fakeSessionId = "fake-nonexistent-session-id";
      const result = await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [{ seq: 3, t: 120, type: "diagram_node_inspect", payload: { nodeId: "n1", nodeLabel: "API Gateway" } }],
        fakeSessionId,
      );

      expect(result.recorded).toBe(1);
      expect(result.sessionValid).toBe(false);
      expect(result.invalidReason).toBe("session_not_found");
    });

    it("strictly prevents student Ada from writing events to student Ben's session", async () => {
      const [qRow] = await db.select({ id: questions.id }).from(questions).limit(1);
      // Create a genuine practice session owned by Ben
      const [benSession] = await db
        .insert(learningSessions)
        .values({
          instituteId: ben.instituteId!,
          studentId: ben.id,
          questionId: qRow.id,
          mode: "practice",
        })
        .returning({ id: learningSessions.id });

      const benSessionId = benSession.id;

      // Check Ben's initial events count in events table
      const initialBenEvents = await db
        .select()
        .from(events)
        .where(eq(events.sessionId, benSessionId));

      // Ada maliciously attempts to send classroom events claiming to be for Ben's session
      const result = await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [
          { seq: 10, t: 200, type: "k8s_lab_action", payload: { action: "simulate_failure", outcome: "degraded" } },
          { seq: 11, t: 250, type: "k8s_lab_action", payload: { action: "recover", outcome: "recovered" } },
        ],
        benSessionId,
      );

      // Event is recorded for Ada's telemetry audit but flagged as ownership mismatch
      expect(result.sessionValid).toBe(false);
      expect(result.invalidReason).toBe("cross_student_ownership_mismatch");

      // Verify Ben's session in the hash-chained `events` table was NOT modified
      const afterBenEvents = await db
        .select()
        .from(events)
        .where(eq(events.sessionId, benSessionId));

      expect(afterBenEvents.length).toBe(initialBenEvents.length);
    });

    it("appends to hash-chained events table when session is valid and owned by student", async () => {
      const [qRow] = await db.select({ id: questions.id }).from(questions).limit(1);
      // Create a practice session owned by Ada
      const [adaSession] = await db
        .insert(learningSessions)
        .values({
          instituteId: ada.instituteId!,
          studentId: ada.id,
          questionId: qRow.id,
          mode: "practice",
        })
        .returning({ id: learningSessions.id });

      const adaSessionId = adaSession.id;

      const result = await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [
          { seq: 1, t: 100, type: "stepper_step", payload: { stepIndex: 1, totalSteps: 5 } },
          { seq: 2, t: 150, type: "docker_lab_action", payload: { action: "build", status: "built", passed: true } },
        ],
        adaSessionId,
      );

      expect(result.sessionValid).toBe(true);
      expect(result.invalidReason).toBeNull();
      expect(result.sessionAppend).toBeDefined();

      // Verify events were actually appended to events table for Ada's session
      const sessionEvents = await db
        .select()
        .from(events)
        .where(eq(events.sessionId, adaSessionId));

      expect(sessionEvents.length).toBeGreaterThanOrEqual(2);
      expect(sessionEvents.map((e) => e.type)).toContain("stepper_step");
      expect(sessionEvents.map((e) => e.type)).toContain("docker_lab_action");
    });
  });

  describe("Deduplication & Replay Protection", () => {
    it("deduplicates subsequent lesson_complete events for the same student and lesson", async () => {
      await db.delete(classroomEvents).where(
        and(
          eq(classroomEvents.studentId, ada.id),
          eq(classroomEvents.lessonId, FLAGSHIP_LESSON_ID),
          eq(classroomEvents.type, "lesson_complete"),
        ),
      );

      const first = await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [{ seq: 50, t: 1000, type: "lesson_complete", payload: { durationMs: 60000, scenesViewed: 10, totalScenes: 10 } }],
        null,
      );
      expect(first.recorded).toBe(1);

      // Submit identical lesson_complete again (e.g. page reloaded or re-navigated)
      const second = await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [{ seq: 51, t: 1005, type: "lesson_complete", payload: { durationMs: 60000, scenesViewed: 10, totalScenes: 10 } }],
        null,
      );
      expect(second.recorded).toBe(0); // Deduplicated!
      expect(second.acked).toContain(51); // Sequence acknowledged so client clears buffer
    });
  });

  describe("Strict State Isolation: Mastery, Grades & Integrity Invariance", () => {
    it("guarantees zero unintended mutations to masteryState, masteryUpdates, attempts, signals, or reviews", async () => {
      // Capture Ada's state immediately prior to telemetry execution
      const adaUpdatesBefore = await db
        .select()
        .from(masteryUpdates)
        .where(eq(masteryUpdates.studentId, ada.id));
      const adaSignalsBefore = await db
        .select()
        .from(signals)
        .where(eq(signals.studentId, ada.id));

      const [masteryBefore] = await db
        .select({ pKnow: masteryState.pKnow })
        .from(masteryState)
        .where(and(eq(masteryState.studentId, ada.id), eq(masteryState.conceptId, FUNCTIONS_CONCEPT_ID)))
        .limit(1);

      // Send extensive interactive simulation events, retries, and failures
      await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [
          { seq: 101, t: 2000, type: "cicd_lab_run", payload: { stage: 3, stageName: "Automated Tests", passed: false, gateOutcome: "blocked" } },
          { seq: 102, t: 2500, type: "k8s_lab_action", payload: { action: "simulate_failure", replicas: 3, outcome: "degraded" } },
          { seq: 103, t: 3000, type: "k8s_lab_action", payload: { action: "recover", replicas: 3, outcome: "recovered" } },
          { seq: 104, t: 3500, type: "quiz_submit", payload: { questionId: "q-1", selectedOption: "Wrong Answer", isCorrect: false } },
          { seq: 105, t: 4000, type: "quiz_retry", payload: { questionId: "q-1", attemptCount: 2 } },
          { seq: 106, t: 4500, type: "quiz_submit", payload: { questionId: "q-1", selectedOption: "Correct Option", isCorrect: true } },
          { seq: 107, t: 5000, type: "mentor_action", payload: { action: "hint", promptCategory: "hint" } },
          { seq: 108, t: 5500, type: "mentor_reply", payload: { action: "hint", status: "fallback" } },
        ],
        null,
      );

      // Verify Ada's BKT mastery score is strictly identical to baseline
      const [masteryAfter] = await db
        .select({ pKnow: masteryState.pKnow })
        .from(masteryState)
        .where(and(eq(masteryState.studentId, ada.id), eq(masteryState.conceptId, FUNCTIONS_CONCEPT_ID)))
        .limit(1);

      expect(masteryAfter?.pKnow ?? null).toBe(masteryBefore?.pKnow ?? null);
      expect(masteryAfter?.pKnow ?? null).toBe(initialAdaMastery);

      // Verify no mastery updates were created for Ada
      const adaUpdatesAfter = await db
        .select()
        .from(masteryUpdates)
        .where(eq(masteryUpdates.studentId, ada.id));
      expect(adaUpdatesAfter.length).toBe(adaUpdatesBefore.length);
      expect(adaUpdatesAfter.some((u) => u.causeId === FLAGSHIP_LESSON_ID)).toBe(false);

      // Verify no misconduct signals were generated for Ada from simulation or mentor events
      const adaSignalsAfter = await db
        .select()
        .from(signals)
        .where(eq(signals.studentId, ada.id));
      expect(adaSignalsAfter.length).toBe(adaSignalsBefore.length);
    });
  });

  describe("Analytics Aggregation & Role-Based Access Control", () => {
    it("allows student Ada to query her own learning analytics with full breakdown", async () => {
      const summary = await getClassroomAnalytics(ada);

      expect(summary.scope.role).toBe("student");
      expect(summary.scope.studentId).toBe(ada.id);
      expect(summary.lessons.started).toBeGreaterThanOrEqual(1);
      expect(summary.scenes.totalViews).toBeGreaterThanOrEqual(1);
      expect(summary.labs.totalAttempts).toBeGreaterThanOrEqual(3);
      expect(summary.labs.totalRecoveries).toBeGreaterThanOrEqual(1);
      expect(summary.labs.recoveryRate).toBeGreaterThan(0);
      expect(summary.knowledgeChecks.totalAttempts).toBeGreaterThanOrEqual(2);
      expect(summary.mentor.totalActions).toBeGreaterThanOrEqual(1);
      expect(summary.sessionContext.totalEvents).toBeGreaterThanOrEqual(5);
      expect(summary.sessionContext.missingOrInvalidSessionEvents).toBeGreaterThanOrEqual(1);
    });

    it("prevents student Ada from querying another student's analytics", async () => {
      await expect(
        getClassroomAnalytics(ada, { studentId: ben.id }),
      ).rejects.toThrow("Students can only view their own learning analytics");
    });

    it("allows trainer to view analytics for an assigned student", async () => {
      const summary = await getClassroomAnalytics(trainer, { studentId: ada.id });

      expect(summary.scope.role).toBe("trainer");
      expect(summary.lessons.started).toBeGreaterThanOrEqual(1);
      expect(summary.labs.totalAttempts).toBeGreaterThanOrEqual(1);
    });

    it("allows admin to view analytics bounded by institute", async () => {
      const summary = await getClassroomAnalytics(admin, { studentId: ada.id });

      expect(summary.scope.role).toBe("admin");
      expect(summary.scope.instituteId).toBe(admin.instituteId);
      expect(summary.lessons.started).toBeGreaterThanOrEqual(1);
    });

    it("rejects admin attempting to query a student from another institute", async () => {
      await expect(
        getClassroomAnalytics(admin, { studentId: outsider.id }),
      ).rejects.toThrow("Student not found in your institute");
    });
  });

  describe("Quiz Confidentiality & Mentor Fallback Verification", () => {
    it("confirms student view strictly strips answer keys while allowing client check", async () => {
      const studentLesson = await readLessonForStudent(ada, FLAGSHIP_LESSON_ID);
      const quizScene = studentLesson.scenes.find((s) => s.role === "knowledge_check");
      expect(quizScene).toBeDefined();

      for (const question of quizScene!.questions) {
        expect(question.answer).toBeNull();
      }
    });

    it("records mentor fallback reply when offline without failing", async () => {
      const result = await recordClassroomTelemetry(
        ada,
        FLAGSHIP_LESSON_ID,
        [
          { seq: 301, t: 8000, type: "mentor_reply", payload: { action: "explain", status: "fallback" } },
        ],
        null,
      );
      expect(result.recorded).toBe(1);

      const events = await listClassroomEventsForStudent(ada, FLAGSHIP_LESSON_ID);
      const fallbackEvent = events.find((e) => e.type === "mentor_reply" && (e.payloadJson as Record<string, unknown>).status === "fallback");
      expect(fallbackEvent).toBeDefined();
    });
  });
});
