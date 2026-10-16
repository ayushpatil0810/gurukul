import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { batchMembers, batchTrainers, batches, institutes, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { readStudentForActor } from "@/lib/services/students";

const instituteId = crypto.randomUUID();
const studentAId = crypto.randomUUID();
const studentBId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const batchId = crypto.randomUUID();
const otherBatchId = crypto.randomUUID();

function actor(id: string, role: Actor["role"]): Actor {
  return {
    id,
    name: role,
    email: `${id}@example.com`,
    role,
    instituteId,
  };
}

afterAll(async () => {
  await db.delete(batches).where(eq(batches.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("student records in postgres", () => {
  it("blocks a student from reading another student and allows a shared-batch trainer", async () => {
    await db.insert(institutes).values({
      id: instituteId,
      name: `Institute ${instituteId}`,
    });
    await db.insert(user).values([
      {
        id: studentAId,
        name: "Student A",
        email: `${studentAId}@example.com`,
        emailVerified: true,
        role: "student",
        instituteId,
      },
      {
        id: studentBId,
        name: "Student B",
        email: `${studentBId}@example.com`,
        emailVerified: true,
        role: "student",
        instituteId,
      },
      {
        id: outsiderId,
        name: "Outsider",
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        role: "student",
        instituteId,
      },
      {
        id: trainerId,
        name: "Trainer",
        email: `${trainerId}@example.com`,
        emailVerified: true,
        role: "trainer",
        instituteId,
      },
    ]);
    await db.insert(batches).values([
      { id: batchId, instituteId, name: `Batch ${batchId}` },
      { id: otherBatchId, instituteId, name: `Other ${otherBatchId}` },
    ]);
    await db.insert(batchMembers).values([
      { batchId, studentId: studentAId, instituteId },
      { batchId, studentId: studentBId, instituteId },
      { batchId: otherBatchId, studentId: outsiderId, instituteId },
    ]);
    await db.insert(batchTrainers).values({ batchId, trainerId, instituteId });

    const own = await readStudentForActor(actor(studentAId, "student"), studentAId);
    expect(own).toMatchObject({ id: studentAId, name: "Student A" });
    expect(JSON.stringify(own)).not.toContain("password");

    await expect(
      readStudentForActor(actor(studentAId, "student"), studentBId),
    ).rejects.toMatchObject({ statusCode: 403 });

    const shared = await readStudentForActor(actor(trainerId, "trainer"), studentBId);
    expect(shared.id).toBe(studentBId);

    await expect(
      readStudentForActor(actor(trainerId, "trainer"), outsiderId),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
