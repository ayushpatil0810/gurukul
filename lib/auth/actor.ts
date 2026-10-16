import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { parseRole, type Role } from "@/lib/auth-fields";
import { getServerSession } from "@/lib/auth-session";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  instituteId: string | null;
};

/**
 * Loads role and institute from the database for the signed-in user.
 * Request bodies are never a source for either value.
 */
export async function getActor(): Promise<Actor | null> {
  const session = await getServerSession();
  if (!session?.user) return null;

  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: parseRole(row.role),
    instituteId: row.instituteId,
  };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw AppError.unauthorized();
  return actor;
}

export function assertActorRole(actor: Actor, allowed: readonly Role[]): void {
  if (!allowed.includes(actor.role)) {
    throw AppError.forbidden("You do not have access to this action");
  }
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute");
  }
}
