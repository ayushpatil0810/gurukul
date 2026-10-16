import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { batchMembers, batchTrainers, user } from "@/db/schema";
import { decideStudentRead } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/actor";
import { parseRole } from "@/lib/auth-fields";
import { AppError } from "@/lib/errors";

export type StudentProfile = {
  id: string;
  name: string;
  email: string;
};

export async function readStudentForActor(
  actor: Actor,
  studentId: string,
): Promise<StudentProfile> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
    })
    .from(user)
    .where(eq(user.id, studentId))
    .limit(1);

  let sharesBatch = false;
  if (actor.role === "trainer" && row) {
    const [membership] = await db
      .select({ batchId: batchMembers.batchId })
      .from(batchMembers)
      .innerJoin(
        batchTrainers,
        and(
          eq(batchTrainers.batchId, batchMembers.batchId),
          eq(batchTrainers.trainerId, actor.id),
        ),
      )
      .where(eq(batchMembers.studentId, studentId))
      .limit(1);
    sharesBatch = Boolean(membership);
  }

  const decision = decideStudentRead({
    actor,
    student: row
      ? {
          id: row.id,
          role: parseRole(row.role),
          instituteId: row.instituteId,
        }
      : null,
    sharesBatch,
  });

  if (decision === "not_found") throw AppError.notFound("Student not found");
  if (decision === "forbidden") {
    throw AppError.forbidden("You can only access your own data");
  }

  return { id: row!.id, name: row!.name, email: row!.email };
}
