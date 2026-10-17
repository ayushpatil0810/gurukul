import { afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  masteryState,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import {
  readLessonForAuthor,
  readLessonForStudent,
} from "@/lib/services/lessons";
import {
  createInitialK8sState,
  k8sReducer,
} from "@/components/lessons/interactive/kubernetes-lab";
import {
  askMentor,
} from "@/lib/engine/lesson-mentor";
import { POST as checkPost } from "@/app/api/lessons/[id]/check/route";
import { POST as mentorPost } from "@/app/api/lessons/[id]/mentor/route";

const FLAGSHIP_LESSON_ID = "4a3a34a7-7596-4d6e-b22e-a909d7f6d7da";

afterAll(async () => {
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("Phase 5.1 — Classroom Engine Integration & Student Journey", () => {
  let ada: Actor;
  let trainer: Actor;
  let outsider: Actor;

  it("loads existing test accounts from the database", async () => {
    const [adaRow] = await db
      .select()
      .from(user)
      .where(eq(user.email, "ada@techsummit.example"))
      .limit(1);

    const [trainerRow] = await db
      .select()
      .from(user)
      .where(eq(user.email, "trainer@techsummit.example"))
      .limit(1);

    expect(adaRow).toBeDefined();
    expect(trainerRow).toBeDefined();

    ada = {
      id: adaRow!.id,
      name: adaRow!.name,
      email: adaRow!.email,
      role: "student",
      instituteId: adaRow!.instituteId,
    };

    trainer = {
      id: trainerRow!.id,
      name: trainerRow!.name,
      email: trainerRow!.email,
      role: "trainer",
      instituteId: trainerRow!.instituteId,
    };

    outsider = {
      id: crypto.randomUUID(),
      name: "Outsider",
      email: "outsider@otherinstitute.example",
      role: "student",
      instituteId: crypto.randomUUID(),
    };
  });

  describe("Student Journey & Scene Verification", () => {
    it("allows authorized student Ada to open the published flagship DevOps lesson", async () => {
      const lesson = await readLessonForStudent(ada, FLAGSHIP_LESSON_ID);

      expect(lesson.id).toBe(FLAGSHIP_LESSON_ID);
      expect(lesson.title).toBe("DevOps Engineering: From Code to Production");
      expect(lesson.conceptName).toBe("Functions");
      expect(lesson.scenes).toHaveLength(10);

      const roles = lesson.scenes.map((s) => s.role);
      expect(roles).toEqual([
        "introduction",
        "diagram",
        "step_by_step",
        "code_walkthrough",
        "interactive_lab", // Docker
        "interactive_lab", // CI/CD
        "interactive_lab", // K8s
        "comparison",
        "knowledge_check",
        "summary",
      ]);
    });

    it("strictly strips quiz answer keys in the student view before submission", async () => {
      const studentView = await readLessonForStudent(ada, FLAGSHIP_LESSON_ID);
      const quizScene = studentView.scenes.find(
        (s) => s.role === "knowledge_check" || s.type === "quiz",
      );

      expect(quizScene).toBeDefined();
      expect(quizScene?.questions.length).toBeGreaterThanOrEqual(3);
      for (const question of quizScene!.questions) {
        expect(question.answer).toBeNull();
      }
    });

    it("preserves answer keys in trainer/author preview for instructional validation", async () => {
      const authorView = await readLessonForAuthor(trainer, FLAGSHIP_LESSON_ID);
      const quizScene = authorView.scenes.find(
        (s) => s.role === "knowledge_check" || s.type === "quiz",
      );

      expect(quizScene).toBeDefined();
      expect(quizScene?.questions.length).toBeGreaterThanOrEqual(3);
      for (const question of quizScene!.questions) {
        expect(question.answer).not.toBeNull();
        expect(typeof question.answer).toBe("string");
      }
    });

    it("verifies interactive visual scene structures (Diagram, Stepper, Walkthrough, Labs)", async () => {
      const lesson = await readLessonForStudent(ada, FLAGSHIP_LESSON_ID);

      // Scene 2: SVG Architecture Diagram
      const diagramScene = lesson.scenes[1];
      expect(diagramScene?.diagram).toBeDefined();
      expect(diagramScene?.diagram?.nodes.length).toBeGreaterThanOrEqual(6);
      expect(diagramScene?.diagram?.edges.length).toBeGreaterThanOrEqual(5);

      // Scene 3: Step-by-Step Stepper
      const stepperScene = lesson.scenes[2];
      expect(stepperScene?.stepper).toBeDefined();
      expect(stepperScene?.stepper?.steps.length).toBeGreaterThanOrEqual(4);

      // Scene 4: Code Walkthrough
      const walkthroughScene = lesson.scenes[3];
      expect(walkthroughScene?.walkthrough).toBeDefined();
      expect(walkthroughScene?.walkthrough?.annotations.length).toBeGreaterThanOrEqual(4);

      // Scene 5: Docker Lab
      const dockerScene = lesson.scenes[4];
      expect(dockerScene?.lab?.kind).toBe("docker");

      // Scene 6: CI/CD Pipeline Lab
      const cicdScene = lesson.scenes[5];
      expect(cicdScene?.lab?.kind).toBe("cicd");

      // Scene 7: Kubernetes Cluster Lab
      const k8sScene = lesson.scenes[6];
      expect(k8sScene?.lab?.kind).toBe("k8s");
    });
  });

  describe("Quiz Answer Verification Service & Guardrails", () => {
    it("evaluates incorrect answer submissions and returns corrective feedback without leaking prior to submit", async () => {
      const { checkLessonQuestion } = await import("@/lib/services/lessons");
      const result = await checkLessonQuestion(ada, FLAGSHIP_LESSON_ID, {
        questionId: "q-1",
        selectedOption: "It immediately kills and restarts the container.",
      });

      expect(result.questionId).toBe("q-1");
      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswer).toContain("LoadBalancer");
      expect(result.explanation).toContain("Readiness probes");
    });

    it("evaluates correct answer submission and returns affirmation and explanation", async () => {
      const { checkLessonQuestion } = await import("@/lib/services/lessons");
      const result = await checkLessonQuestion(ada, FLAGSHIP_LESSON_ID, {
        questionId: "q-1",
        selectedOption:
          "It removes the pod IP from active LoadBalancer endpoints without killing the process.",
      });

      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toContain("LoadBalancer");
      expect(result.explanation).toContain("Readiness probes");
    });

    it("evaluates questions 2 and 3 correctly", async () => {
      const { checkLessonQuestion } = await import("@/lib/services/lessons");
      const q2 = await checkLessonQuestion(ada, FLAGSHIP_LESSON_ID, {
        questionId: "q-2",
        selectedOption:
          "To minimize final image size and eliminate attack vectors by omitting compilers and shells.",
      });
      expect(q2.isCorrect).toBe(true);
      expect(q2.explanation).toContain("Docker");

      const q3 = await checkLessonQuestion(ada, FLAGSHIP_LESSON_ID, {
        questionId: "q-3",
        selectedOption:
          "Downstream stages must be blocked immediately to protect staging and production environments.",
      });
      expect(q3.isCorrect).toBe(true);
      expect(q3.explanation).toContain("continuous delivery");
    });

    it("rejects checks for non-existent questions with 404", async () => {
      const { checkLessonQuestion } = await import("@/lib/services/lessons");
      await expect(
        checkLessonQuestion(ada, FLAGSHIP_LESSON_ID, {
          questionId: "non-existent-question-id",
          selectedOption: "Any choice",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("Authorization & Confidentiality Guardrails", () => {
    it("prevents an outsider student from another institute from accessing the lesson", async () => {
      await expect(
        readLessonForStudent(outsider, FLAGSHIP_LESSON_ID),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects unauthorized students from accessing the check service", async () => {
      const { checkLessonQuestion } = await import("@/lib/services/lessons");
      await expect(
        checkLessonQuestion(outsider, FLAGSHIP_LESSON_ID, {
          questionId: "q-1",
          selectedOption: "Something",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects unauthenticated requests to the check API route with 401", async () => {
      const req = new Request(`http://localhost:3000/api/lessons/${FLAGSHIP_LESSON_ID}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: "q-1",
          selectedOption: "Something",
        }),
      });

      const res = await checkPost(req, {
        params: Promise.resolve({ id: FLAGSHIP_LESSON_ID }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to the mentor API route with 401", async () => {
      const req = new Request(`http://localhost:3000/api/lessons/${FLAGSHIP_LESSON_ID}/mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneTitle: "Architecture Diagram",
          sceneRole: "diagram",
          action: "hint",
        }),
      });

      const res = await mentorPost(req, {
        params: Promise.resolve({ id: FLAGSHIP_LESSON_ID }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("Interactive Simulation Lab State Machines", () => {
    it("executes the complete Kubernetes failure-and-recovery lifecycle deterministically", () => {
      // 1. Initial State
      let state = createInitialK8sState();
      expect(state.desiredReplicas).toBe(3);
      expect(state.availableReplicas).toBe(3);
      expect(state.deploymentStatus).toBe("Healthy");
      expect(state.pods.every((p) => p.status === "Ready")).toBe(true);

      // 2. Scale up to 4 replicas
      state = k8sReducer(state, { type: "SET_REPLICAS", count: 4 });
      expect(state.desiredReplicas).toBe(4);
      expect(state.availableReplicas).toBe(4);
      expect(state.pods).toHaveLength(4);

      // 3. Trigger Readiness Probe Failure
      state = k8sReducer(state, {
        type: "TRIGGER_FAILURE",
        scenario: "readiness_probe_failure",
      });
      expect(state.activeScenario).toBe("readiness_probe_failure");
      expect(state.deploymentStatus).toBe("Degraded");
      expect(state.serviceStatus).toBe("Warning");
      expect(state.availableReplicas).toBe(3); // 4 - 1 = 3
      const unhealthyPod = state.pods.find((p) => p.status === "Unhealthy");
      expect(unhealthyPod).toBeDefined();
      expect(unhealthyPod?.readyCount).toBe("0/1");

      // 4. Apply Corrective Patch
      state = k8sReducer(state, { type: "APPLY_CORRECTIVE_ACTION" });
      expect(state.activeScenario).toBe("none");
      expect(state.deploymentStatus).toBe("Healthy");
      expect(state.serviceStatus).toBe("Active");
      expect(state.availableReplicas).toBe(4);
      expect(state.pods.every((p) => p.status === "Ready")).toBe(true);

      // 5. Trigger Rolling Update
      state = k8sReducer(state, { type: "TRIGGER_ROLLING_UPDATE" });
      expect(state.pods.every((p) => p.version === "v1.1.0")).toBe(true);

      // 6. Reset Lab
      state = k8sReducer(state, { type: "RESET" });
      expect(state.desiredReplicas).toBe(3);
      expect(state.availableReplicas).toBe(3);
      expect(state.deploymentStatus).toBe("Healthy");
    });
  });

  describe("Data Integrity Guarantee (Zero Unintended Mutations)", () => {
    it("guarantees viewing lessons, asking mentor, and answering knowledge checks does not alter mastery or attempts", async () => {
      // Inspect mastery and attempt counts for Ada
      const masteryBefore = await db
        .select({ conceptId: masteryState.conceptId, pKnow: masteryState.pKnow })
        .from(masteryState)
        .where(eq(masteryState.studentId, ada.id));

      const countsBefore = await db.execute(sql`
        select
          (select count(*) from mastery_updates where student_id = ${ada.id}) as updates,
          (select count(*) from attempts where session_id in (select id from learning_sessions where student_id = ${ada.id})) as attempts,
          (select count(*) from signals where student_id = ${ada.id}) as signals,
          (select count(*) from reviews r where exists (select 1 from signals s where s.id = r.signal_id and s.student_id = ${ada.id})) as reviews
      `);

      // Run multiple student interactions
      await readLessonForStudent(ada, FLAGSHIP_LESSON_ID);

      // Mentor request
      await askMentor({
        lessonTitle: "DevOps Engineering",
        conceptName: "Functions",
        sceneTitle: "Flagship Kubernetes Cluster Simulation",
        sceneRole: "interactive_lab",
        action: "hint",
      });

      // Submit quiz answers (both incorrect and correct)
      const req1 = new Request(`http://localhost:3000/api/lessons/${FLAGSHIP_LESSON_ID}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-actor": JSON.stringify(ada),
        },
        body: JSON.stringify({
          questionId: "q-1",
          selectedOption: "It immediately kills and restarts the container.",
        }),
      });
      await checkPost(req1, { params: Promise.resolve({ id: FLAGSHIP_LESSON_ID }) });

      const req2 = new Request(`http://localhost:3000/api/lessons/${FLAGSHIP_LESSON_ID}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-actor": JSON.stringify(ada),
        },
        body: JSON.stringify({
          questionId: "q-1",
          selectedOption:
            "It removes the pod IP from active LoadBalancer endpoints without killing the process.",
        }),
      });
      await checkPost(req2, { params: Promise.resolve({ id: FLAGSHIP_LESSON_ID }) });

      // Re-inspect database state after all interactions
      const masteryAfter = await db
        .select({ conceptId: masteryState.conceptId, pKnow: masteryState.pKnow })
        .from(masteryState)
        .where(eq(masteryState.studentId, ada.id));

      const countsAfter = await db.execute(sql`
        select
          (select count(*) from mastery_updates where student_id = ${ada.id}) as updates,
          (select count(*) from attempts where session_id in (select id from learning_sessions where student_id = ${ada.id})) as attempts,
          (select count(*) from signals where student_id = ${ada.id}) as signals,
          (select count(*) from reviews r where exists (select 1 from signals s where s.id = r.signal_id and s.student_id = ${ada.id})) as reviews
      `);

      // Strict assertions: EXACTLY identical values
      expect(masteryAfter).toEqual(masteryBefore);
      expect((countsAfter.rows ?? countsAfter)[0]).toEqual((countsBefore.rows ?? countsBefore)[0]);
    });
  });
});
