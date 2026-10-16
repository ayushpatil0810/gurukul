import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, institutes, masteryState, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { addPrerequisite, createConcept, createModule } from "@/lib/services/concepts";
import { createQuestion } from "@/lib/services/questions";
import { bktUpdate } from "@/lib/engine/bkt";
import { hashEvent, verifyEventChain } from "@/lib/engine/event-chain";
import { nextQuestion, runSession, startSession, submitSession } from "@/lib/services/assessment";
import { appendEvents, listEvents } from "@/lib/services/events";
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

    const masteryBefore = (
      await db.select().from(masteryState).where(eq(masteryState.studentId, adaId))
    ).sort((left, right) => left.conceptId.localeCompare(right.conceptId));
    const timeline = await appendEvents(ada, practice.id, [
      { seq: 1, t: 0, type: "session_start", payload: {} },
      { seq: 2, t: 8, type: "insert", payload: { length: 1 } },
    ]);
    expect(timeline.acked).toEqual([1, 2]);
    expect(timeline.events.map((event) => event.seq)).toEqual([1, 2]);
    expect(timeline.events.every((event) => event.schemaVersion === 2 && event.receivedAt)).toBe(true);
    const receivedAt = timeline.events[0]?.receivedAt;

    const withGap = await appendEvents(ada, practice.id, [
      { seq: 4, t: 40, type: "paste", payload: { length: 12, receivedAt: "1999-01-01T00:00:00.000Z", prevHash: "client" } },
    ]);
    expect(withGap.acked).toEqual([4]);
    expect(withGap.events.filter((event) => event.seq < 1_000_001).map((event) => event.seq)).toEqual([1, 2, 4]);
    const note = withGap.events.find((event) => event.type === "data_quality");
    expect(note?.payload).toMatchObject({ missingFrom: 3, missingTo: 3, misconduct: false });
    expect(withGap.events.find((event) => event.seq === 4)?.payload).toEqual({ length: 12 });
    expect(withGap.events.find((event) => event.seq === 4)?.t).toBe(40);
    expect(withGap.events.find((event) => event.seq === 1)?.receivedAt).toBe(receivedAt);
    expect(verifyEventChain(withGap.events)).toBe(true);

    const late = await appendEvents(ada, practice.id, [
      {
        seq: 3,
        t: 15,
        type: "insert",
        payload: { schemaVersion: 2, range: { start: 0, end: 0 }, text: "x", removed: "" },
      },
    ]);
    expect(late.events.find((event) => event.seq === 3)).toMatchObject({ t: 15, type: "insert" });
    expect(late.events.some((event) => event.type === "data_quality" && (event.payload as { resolved?: boolean }).resolved)).toBe(
      true,
    );
    expect(verifyEventChain(late.events)).toBe(true);

    const duplicate = await appendEvents(ada, practice.id, [
      { seq: 3, t: 999, type: "delete", payload: { length: 9 } },
    ]);
    expect(duplicate.acked).toEqual([3]);
    expect(duplicate.events.find((event) => event.seq === 3)?.t).toBe(15);
    expect(duplicate.events.find((event) => event.seq === 3)?.type).toBe("insert");
    expect(await listEvents(ada, practice.id)).toEqual(duplicate.events);
    expect(
      (await db.select().from(masteryState).where(eq(masteryState.studentId, adaId))).sort((left, right) =>
        left.conceptId.localeCompare(right.conceptId),
      ),
    ).toEqual(masteryBefore);

    await expect(listEvents(ben, practice.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      appendEvents(ben, practice.id, [{ seq: 5, t: 1, type: "focus", payload: {} }]),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      appendEvents(trainer, practice.id, [{ seq: 5, t: 1, type: "focus", payload: {} }]),
    ).rejects.toMatchObject({ statusCode: 403 });

    const gradedEvents = await appendEvents(ada, graded.id, [{ seq: 1, t: 0, type: "session_start", payload: {} }]);
    expect(gradedEvents.acked).toEqual([1]);
    expect(JSON.stringify(gradedEvents)).not.toContain(secret);
    expect(JSON.stringify(gradedEvents)).not.toContain("expectedOutput");

    await Promise.all([
      appendEvents(ada, practice.id, [{ seq: 5, t: 50, type: "focus", payload: { marker: "five" } }]),
      appendEvents(ada, practice.id, [{ seq: 6, t: 60, type: "blur", payload: { marker: "six" } }]),
    ]);
    const concurrent = await listEvents(ada, practice.id);
    expect(concurrent.find((event) => event.seq === 5)?.type).toBe("focus");
    expect(concurrent.find((event) => event.seq === 6)?.type).toBe("blur");
    expect(verifyEventChain(concurrent)).toBe(true);

    const legacySession = await startSession(ada, { questionId: functionsQuestion.id, mode: "practice" });
    const legacyStart = {
      seq: 1,
      t: 0,
      type: "session_start",
      payload: {},
      prevHash: null as string | null,
      chainIndex: 1,
      schemaVersion: 1,
    };
    const legacyInsert = {
      seq: 2,
      t: 5,
      type: "insert",
      payload: { length: 1 },
      prevHash: hashEvent(legacyStart),
      chainIndex: 2,
      schemaVersion: 1,
    };
    const legacyGap = {
      seq: 3,
      t: 6,
      type: "data_quality",
      payload: { missing: 3 },
      prevHash: hashEvent(legacyInsert),
      chainIndex: 3,
      schemaVersion: 1,
    };
    await db.insert(events).values(
      [legacyStart, legacyInsert, legacyGap].map((event) => ({
        sessionId: legacySession.id,
        instituteId,
        seq: event.seq,
        t: event.t,
        type: event.type,
        payloadJson: event.payload,
        prevHash: event.prevHash,
        schemaVersion: event.schemaVersion,
        chainIndex: event.chainIndex,
      })),
    );
    const continued = await appendEvents(ada, legacySession.id, [
      { seq: 4, t: 9, type: "paste", payload: { length: 2 } },
    ]);
    expect(verifyEventChain(continued.events)).toBe(true);
    expect(continued.events.find((event) => event.seq === 4)?.prevHash).toBe(hashEvent(legacyGap));
    const replay = await appendEvents(ada, legacySession.id, [
      { seq: 3, t: 99, type: "insert", payload: { text: "invented" } },
    ]);
    expect(replay.acked).toEqual([3]);
    expect(replay.events.find((event) => event.seq === 3)).toMatchObject({
      type: "data_quality",
      t: 6,
      payload: { missing: 3 },
      schemaVersion: 1,
      receivedAt: null,
    });
    expect(continued.events.find((event) => event.seq === 4)?.schemaVersion).toBe(2);
    expect(continued.events.find((event) => event.seq === 4)?.receivedAt).toEqual(expect.any(String));
  });
});
