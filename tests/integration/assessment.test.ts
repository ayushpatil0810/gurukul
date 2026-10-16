import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutes, masteryState, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { addPrerequisite, createConcept, createModule } from "@/lib/services/concepts";
import { createQuestion } from "@/lib/services/questions";
import { bktUpdate } from "@/lib/engine/bkt";
import { nextQuestion, runSession, startSession, submitSession } from "@/lib/services/assessment";
import { RunQueue } from "@/sandbox/queue";
import type { SandboxRunner } from "@/sandbox/types";

const instituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const adaId = crypto.randomUUID();
const benId = crypto.randomUUID();
const secret = `SECRET_OUT_${instituteId}`;

const trainer: Actor = {
  id: trainerId,
  name: "Trainer",
  email: `${trainerId}@example.com`,
  role: "trainer",
  instituteId,
};

function student(id: string, name: string): Actor {
  return { id, name, email: `${id}@example.com`, role: "student", instituteId };
}

const runner: SandboxRunner = {
  async run(_language, _code, stdin) {
    return {
      outcome: "ok",
      stdout: stdin.startsWith("HIDDEN") ? `${secret}\n` : "visible-ok\n",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 4,
      message: "The program finished.",
    };
  },
};

const deps = {
  runner,
  queue: new RunQueue({ concurrency: 2, perStudentPerMinute: 30 }),
};

afterAll(async () => {
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("assessment services", () => {
  it("routes two students differently, requires consent, and hides hidden tests", async () => {
    await db.insert(institutes).values({ id: instituteId, name: `Learn ${instituteId}` });
    await db.insert(user).values([
      { id: trainerId, name: "Trainer", email: trainer.email, emailVerified: true, role: "trainer", instituteId },
      { id: adaId, name: "Ada", email: `${adaId}@example.com`, emailVerified: true, role: "student", instituteId },
      { id: benId, name: "Ben", email: `${benId}@example.com`, emailVerified: true, role: "student", instituteId },
    ]);

    const variables = await createConcept(trainer, { name: `Variables ${instituteId}` });
    const functions = await createConcept(trainer, { name: `Functions ${instituteId}` });
    const classes = await createConcept(trainer, { name: `Classes ${instituteId}` });
    await addPrerequisite(trainer, functions.id, variables.id);
    await addPrerequisite(trainer, classes.id, functions.id);
    await createModule(trainer, {
      name: `Module ${instituteId}`,
      goalConceptId: classes.id,
      masteryThreshold: 0.8,
      conceptIds: [variables.id, functions.id, classes.id],
    });

    const published = {
      languages: ["javascript" as const],
      starterCode: { javascript: "console.log('todo')" },
      status: "published" as const,
      tests: [
        { visibility: "visible" as const, input: "1\n", expectedOutput: "visible-ok\n" },
        { visibility: "hidden" as const, input: `HIDDEN ${instituteId}\n`, expectedOutput: `${secret}\n` },
      ],
    };
    await createQuestion(trainer, {
      statement: `Variables ${instituteId}`,
      difficulty: 1,
      conceptIds: [variables.id],
      ...published,
    });
    const functionsQuestion = await createQuestion(trainer, {
      statement: `Functions ${instituteId}`,
      difficulty: 1,
      conceptIds: [functions.id],
      ...published,
    });
    await createQuestion(trainer, {
      statement: `Classes ${instituteId}`,
      difficulty: 2,
      conceptIds: [classes.id],
      ...published,
    });

    await db.insert(masteryState).values([
      { studentId: adaId, conceptId: variables.id, instituteId, pKnow: 0.9 },
      { studentId: adaId, conceptId: functions.id, instituteId, pKnow: 0.3 },
      { studentId: benId, conceptId: variables.id, instituteId, pKnow: 0.95 },
      { studentId: benId, conceptId: functions.id, instituteId, pKnow: 0.9 },
      { studentId: benId, conceptId: classes.id, instituteId, pKnow: 0.35 },
    ]);

    const ada = student(adaId, "Ada");
    const ben = student(benId, "Ben");
    const adaNext = await nextQuestion(ada);
    const benNext = await nextQuestion(ben);
    expect(adaNext.decision.conceptId).toBe(functions.id);
    expect(benNext.decision.conceptId).toBe(classes.id);
    expect(adaNext.decision.reason).toContain("0.30");
    expect(benNext.decision.reason).toContain("0.35");
    expect(JSON.stringify(adaNext)).not.toContain(secret);
    expect(JSON.stringify(adaNext)).not.toContain(`HIDDEN ${instituteId}`);

    await expect(startSession(ada, { questionId: functionsQuestion.id, mode: "graded" })).rejects.toMatchObject({
      statusCode: 409,
    });

    const practice = await startSession(ada, { questionId: functionsQuestion.id, mode: "practice" });
    expect(practice.recording).toBe(false);
    await expect(runSession(ben, practice.id, { language: "javascript", code: "return 1" }, deps)).rejects.toMatchObject({
      statusCode: 403,
    });

    const visible = await runSession(ada, practice.id, { language: "javascript", code: "return 1" }, deps);
    expect(visible.tests[0]?.stdout).toBe("visible-ok\n");

    const submitted = await submitSession(ada, practice.id, { language: "javascript", code: "return 1" }, deps);
    const serialized = JSON.stringify(submitted);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(`HIDDEN ${instituteId}`);
    expect(submitted.passed).toBe(1);
    expect(submitted.mastery).toEqual([]);

    const { acceptConsent } = await import("@/lib/services/assessment");
    await acceptConsent(ada);
    const graded = await startSession(ada, { questionId: functionsQuestion.id, mode: "graded" });
    expect(graded.recording).toBe(true);
    const gradedSubmit = await submitSession(ada, graded.id, { language: "javascript", code: "return 1" }, deps);
    expect(JSON.stringify(gradedSubmit)).not.toContain(secret);
    expect(gradedSubmit.mastery[0]?.before).toBeCloseTo(0.3, 6);
    expect(gradedSubmit.mastery[0]?.after).toBeCloseTo(bktUpdate(0.3, true), 10);
  });
});
