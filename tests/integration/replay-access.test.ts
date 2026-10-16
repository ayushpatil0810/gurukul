import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { batchMembers, batchTrainers, batches, events, institutes, learningSessions, questions, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { planEventAppend } from "@/lib/engine/event-chain";
import { listReplaySessions, readReplay } from "@/lib/services/replay";

const instituteId = crypto.randomUUID();
const otherInstituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const adminId = crypto.randomUUID();
const adaId = crypto.randomUUID();
const benId = crypto.randomUUID();
const secret = `REFERENCE_${instituteId}`;

function person(id: string, role: Actor["role"], institute: string): Actor {
  return { id, name: role, email: `${id}@example.com`, role, instituteId: institute };
}

afterAll(async () => {
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, otherInstituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  await db.delete(institutes).where(eq(institutes.id, otherInstituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("replay authorization", () => {
  it("shows a session only to the batch trainer and the institute admin", async () => {
    await db.insert(institutes).values([
      { id: instituteId, name: `Replay ${instituteId}` },
      { id: otherInstituteId, name: `Other ${otherInstituteId}` },
    ]);
    await db.insert(user).values([
      { id: trainerId, name: "Trainer", email: `${trainerId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: outsiderId, name: "Outsider", email: `${outsiderId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: adminId, name: "Admin", email: `${adminId}@example.com`, emailVerified: true, role: "admin", instituteId },
      { id: adaId, name: "Ada", email: `${adaId}@example.com`, emailVerified: true, role: "student", instituteId },
      { id: benId, name: "Ben", email: `${benId}@example.com`, emailVerified: true, role: "student", instituteId },
    ]);
    const [batch] = await db.insert(batches).values({ instituteId, name: `Batch ${instituteId}` }).returning({ id: batches.id });
    await db.insert(batchTrainers).values({ batchId: batch!.id, trainerId, instituteId });
    await db.insert(batchMembers).values({ batchId: batch!.id, studentId: adaId, instituteId });
    const [question] = await db
      .insert(questions)
      .values({
        instituteId,
        statement: "Replay question",
        difficulty: 1,
        languages: ["javascript"],
        starterCodeJson: { javascript: "" },
        status: "published",
        referenceSolution: secret,
      })
      .returning({ id: questions.id });
    const [session] = await db
      .insert(learningSessions)
      .values({ instituteId, studentId: adaId, questionId: question!.id, mode: "practice" })
      .returning({ id: learningSessions.id });
    const planned = planEventAppend([], [
      { seq: 1, t: 0, type: "session_start", payload: { baseline: "answer", referenceSolution: secret } },
    ]);
    await db.insert(events).values(
      planned.map((event) => ({
        sessionId: session!.id,
        instituteId,
        seq: event.seq,
        t: event.t,
        type: event.type,
        payloadJson: event.payload as Record<string, unknown>,
        prevHash: event.prevHash,
        schemaVersion: event.schemaVersion,
        chainIndex: event.chainIndex,
      })),
    );

    const trainer = person(trainerId, "trainer", instituteId);
    const replay = await readReplay(trainer, session!.id);
    expect(replay.session.studentName).toBe("Ada");
    expect(replay.chainValid).toBe(true);
    expect(replay.events[0]?.payload).toMatchObject({ baseline: "answer" });
    const serialized = JSON.stringify(replay);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("expectedOutput");
    expect((await listReplaySessions(trainer)).some((item) => item.id === session!.id)).toBe(true);

    await expect(readReplay(person(outsiderId, "trainer", instituteId), session!.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(readReplay(person(adaId, "student", instituteId), session!.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(readReplay(person(benId, "student", instituteId), session!.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(listReplaySessions(person(adaId, "student", instituteId))).rejects.toMatchObject({ statusCode: 403 });
    await expect(readReplay(trainer, crypto.randomUUID())).rejects.toMatchObject({ statusCode: 404 });
    await expect(readReplay(person(trainerId, "trainer", otherInstituteId), session!.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    const adminView = await readReplay(person(adminId, "admin", instituteId), session!.id);
    expect(adminView.session.questionStatement).toBe("Replay question");
    expect(JSON.stringify(adminView)).not.toContain(secret);
  });
});
