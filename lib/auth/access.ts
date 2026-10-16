import type { Role } from "@/lib/auth-fields";

export type AccessActor = {
  id: string;
  role: Role;
  instituteId: string | null;
};

export type StudentRecord = {
  id: string;
  role: Role;
  instituteId: string | null;
};

export type AccessDecision = "allow" | "forbidden" | "not_found";

/**
 * Students may read only their own row. Trainers may read students who share
 * one of their batches. Admins may read students in their institute.
 * A miss outside the actor's institute is not_found so ids are not confirmed.
 */
export function decideStudentRead(input: {
  actor: AccessActor;
  student: StudentRecord | null;
  sharesBatch: boolean;
}): AccessDecision {
  const { actor, student, sharesBatch } = input;
  if (!student || student.role !== "student") return "not_found";

  const sameInstitute =
    actor.instituteId !== null &&
    student.instituteId !== null &&
    actor.instituteId === student.instituteId;

  if (actor.role === "student") {
    if (actor.id === student.id) return "allow";
    return sameInstitute ? "forbidden" : "not_found";
  }

  if (!sameInstitute) return "not_found";
  if (actor.role === "admin") return "allow";
  if (actor.role === "trainer") return sharesBatch ? "allow" : "forbidden";
  return "forbidden";
}

export function roleAllowed(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}
