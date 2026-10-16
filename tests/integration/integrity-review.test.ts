import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batchMembers,
  batchTrainers,
  batches,
  concepts,
  consents,
  events,
  institutes,
  learningSessions,
  masteryState,
  masteryUpdates,
  questions,
  reviews,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import {
  listReviewQueue,
  persistSessionSignals,
  readSignal,
  recordSignalReview,
} from "@/lib/services/integrity";

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

function editor(seq: number, t: number, type: string, text: string, at = 0) {
  return {
    seq,
    t,
    type,
    payload: {
      schemaVersion: 2,
      range: { start: at, end: at },
      text,
      removed: "",
      length: text.length,
      removedLength: 0,
    },
  };
}

afterAll(async () => {
  await db.delete(reviews).where(eq(reviews.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, otherInstituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  await db.delete(institutes).where(eq(institutes.id, otherInstituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("integrity review", () => {
  it("keeps detection idempotent, preserves review history, and does not change grades or mastery", async () => {
    await db.insert(institutes).values([
      { id: instituteId, name: `Review ${instituteId}` },
      { id: otherInstituteId, name: `Other ${otherInstituteId}` },
    ]);
    await db.insert(user).values([
      { id: trainerId, name: "Trainer", email: `${trainerId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: outsiderId, name: "Outsider", email: `${outsiderId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: adminId, name: "Admin", email: `${adminId}@example.com`, emailVerified: true, role: "admin", instituteId },
      { id: adaId, name: "Ada", email: `${adaId}@example.com`, emailVerified: true, role: "student", instituteId },
      { id: benId, name: "Ben", email: `${benId}@example.com`, emailVerified: true, role: "student", instituteId },
    ]);
    const [batch] = await db.insert(batches).values({ instituteId, name: `Batch ${instituteId}` }).returning();
    const [otherBatch] = await db.insert(batches).values({ instituteId, name: `Other batch ${instituteId}` }).returning();
    await db.insert(batchTrainers).values({ batchId: batch!.id, trainerId, instituteId });
    await db.insert(batchMembers).values([
      { batchId: batch!.id, studentId: adaId, instituteId },
      { batchId: otherBatch!.id, studentId: benId, instituteId },
    ]);
    const [concept] = await db
      .insert(concepts)
      .values({ instituteId, name: `Concept ${instituteId}` })
      .returning();
    await db.insert(masteryState).values({
      studentId: adaId,
      conceptId: concept!.id,
      instituteId,
      pKnow: 0.3,
    });
    const [question] = await db
      .insert(questions)
      .values({
        instituteId,
        statement: "Review question",
        difficulty: 1,
        languages: ["javascript"],
        starterCodeJson: { javascript: "" },
        status: "published",
        referenceSolution: secret,
      })
      .returning();
    const [consent] = await db
      .insert(consents)
      .values({ instituteId, studentId: adaId, policyVersion: "test" })
      .returning();
    const [session] = await db
      .insert(learningSessions)
      .values({
        instituteId,
        studentId: adaId,
        questionId: question!.id,
        mode: "graded",
        consentId: consent!.id,
      })
      .returning();
    await db.insert(attempts).values({
      instituteId,
      sessionId: session!.id,
      kind: "submit",
      language: "javascript",
      code: "untouched",
      passRate: 0.5,
    });
    await db.insert(events).values([
      row(session!.id, { seq: 1, t: 0, type: "session_start", payload: { baseline: "" } }),
      row(session!.id, editor(2, 4120, "paste", secret)),
    ]);

    const trainer = person(trainerId, "trainer", instituteId);
    const first = await persistSessionSignals(session!.id);
    const second = await persistSessionSignals(session!.id);
    expect(first.signalIds).toHaveLength(1);
    expect(second.signalIds).toEqual(first.signalIds);

    const before = new Date();
    const reviewed = await recordSignalReview(trainer, first.signalIds[0]!, { disposition: "dismissed", note: "" });
    expect(reviewed.reviewStatus).toBe("dismissed");
    expect(reviewed.reviews).toHaveLength(1);
    expect(reviewed.reviews[0]?.reviewerName).toBe("Trainer");
    expect(reviewed.reviews[0]?.note).toBe("");
    expect(Date.parse(reviewed.reviews[0]!.createdAt)).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(reviewed.replayHref).toContain("t=4120");
    expect(JSON.stringify(reviewed)).not.toContain(secret);

    const again = await persistSessionSignals(session!.id);
    expect(again.signalIds).toEqual(first.signalIds);
    const kept = await readSignal(trainer, first.signalIds[0]!);
    expect(kept.reviewStatus).toBe("dismissed");
    expect(kept.reviews).toHaveLength(1);

    const escalated = await recordSignalReview(trainer, first.signalIds[0]!, {
      disposition: "escalated",
      note: "Please talk with Ada about this paste.",
    });
    expect(escalated.reviewStatus).toBe("escalated");
    expect(escalated.reviews).toHaveLength(2);
    expect(escalated.reviews[0]?.disposition).toBe("dismissed");
    expect(escalated.reviews[1]?.disposition).toBe("escalated");
    const visible = await listReviewQueue(trainer, { batchId: batch!.id, type: "large_paste", status: "escalated" });
    expect(visible.map((item) => item.id)).toContain(first.signalIds[0]);

    await db.insert(events).values([row(session!.id, editor(3, 8000, "insert", "n".repeat(400), secret.length))]);
    const late = await persistSessionSignals(session!.id);
    expect(late.signalIds).not.toContain(first.signalIds[0]);
    const withdrawn = await readSignal(trainer, first.signalIds[0]!);
    expect(withdrawn.supported).toBe(false);
    expect(withdrawn.reviews).toHaveLength(2);
    expect(withdrawn.reviewStatus).toBe("escalated");

    const [mastery] = await db.select().from(masteryState).where(eq(masteryState.studentId, adaId));
    expect(mastery?.pKnow).toBe(0.3);
    expect(await db.select().from(masteryUpdates).where(eq(masteryUpdates.studentId, adaId))).toEqual([]);
    const [attempt] = await db.select().from(attempts).where(eq(attempts.sessionId, session!.id));
    expect(attempt?.passRate).toBe(0.5);

    const [benConsent] = await db.insert(consents).values({ instituteId, studentId: benId, policyVersion: "test" }).returning();
    const [benSession] = await db
      .insert(learningSessions)
      .values({
        instituteId,
        studentId: benId,
        questionId: question!.id,
        mode: "graded",
        consentId: benConsent!.id,
      })
      .returning();
    await db.insert(events).values([
      row(benSession!.id, { seq: 1, t: 0, type: "session_start", payload: { baseline: "" } }),
      row(benSession!.id, editor(2, 1000, "paste", "z".repeat(180))),
    ]);
    await persistSessionSignals(benSession!.id);

    const queue = await listReviewQueue(trainer);
    expect(queue.some((item) => item.id === first.signalIds[0])).toBe(false);
    expect(queue.some((item) => item.sessionId === benSession!.id)).toBe(false);
    const adaQueue = await listReviewQueue(trainer, { batchId: batch!.id, type: "large_paste", status: "escalated" });
    expect(adaQueue.map((item) => item.id)).not.toContain(first.signalIds[0]);

    const adminQueue = await listReviewQueue(person(adminId, "admin", instituteId), { type: "large_paste" });
    expect(adminQueue.some((item) => item.sessionId === benSession!.id)).toBe(true);

    await expect(readSignal(person(outsiderId, "trainer", instituteId), first.signalIds[0]!)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(listReviewQueue(person(adaId, "student", instituteId))).rejects.toMatchObject({ statusCode: 403 });
    await expect(readSignal(person(adaId, "student", instituteId), first.signalIds[0]!)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      recordSignalReview(person(benId, "student", instituteId), first.signalIds[0]!, { disposition: "dismissed" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(readSignal(trainer, crypto.randomUUID())).rejects.toMatchObject({ statusCode: 404 });
    await expect(readSignal(person(adminId, "admin", otherInstituteId), first.signalIds[0]!)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(recordSignalReview(trainer, first.signalIds[0]!, { disposition: "escalated", note: " " })).rejects.toMatchObject({
      statusCode: 400,
    });

    const history = await db.select().from(reviews).where(eq(reviews.signalId, first.signalIds[0]!));
    expect(history.map((item) => item.reviewerId)).toEqual([trainerId, trainerId]);
    expect(history.every((item) => item.createdAt instanceof Date)).toBe(true);
  });
});

function row(
  sessionId: string,
  event: { seq: number; t: number; type: string; payload: Record<string, unknown> },
) {
  return {
    sessionId,
    instituteId,
    seq: event.seq,
    t: event.t,
    type: event.type,
    payloadJson: event.payload,
    prevHash: null,
    schemaVersion: 2,
    chainIndex: event.seq,
    receivedAt: new Date(),
  };
}
