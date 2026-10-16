import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, learningSessions } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { planEventAppend, type TimelineEvent } from "@/lib/engine/event-chain";

export const clientEventTypes = [
  "session_start",
  "session_end",
  "insert",
  "delete",
  "paste",
  "cut",
  "copy",
  "undo",
  "redo",
  "autocomplete_accept",
  "run",
  "run_result",
  "submit",
  "submit_result",
  "focus",
  "blur",
  "tab_hidden",
  "tab_visible",
] as const;

export type ClientEventType = (typeof clientEventTypes)[number];

export type IncomingEvent = {
  seq: number;
  t: number;
  type: ClientEventType;
  payload: Record<string, unknown>;
};

export async function appendEvents(actor: Actor, sessionId: string, incoming: IncomingEvent[]) {
  const session = await ownedSession(actor, sessionId);
  const existing = await listRows(sessionId);
  const planned = planEventAppend(existing, incoming);
  if (planned.length === 0) return listRows(sessionId);

  await db.insert(events).values(
    planned.map((event) => ({
      sessionId,
      seq: event.seq,
      instituteId: session.instituteId,
      t: event.t,
      type: event.type,
      payloadJson: event.payload ?? {},
      prevHash: event.prevHash,
    })),
  );
  return listRows(sessionId);
}

export async function listEvents(actor: Actor, sessionId: string) {
  await ownedSession(actor, sessionId);
  return listRows(sessionId);
}

async function listRows(sessionId: string): Promise<TimelineEvent[]> {
  const rows = await db
    .select({
      seq: events.seq,
      t: events.t,
      type: events.type,
      payload: events.payloadJson,
      prevHash: events.prevHash,
    })
    .from(events)
    .where(eq(events.sessionId, sessionId))
    .orderBy(asc(events.seq));
  return rows.map((row) => ({
    seq: row.seq,
    t: row.t,
    type: row.type,
    payload: row.payload,
    prevHash: row.prevHash,
  }));
}

async function ownedSession(actor: Actor, sessionId: string) {
  if (actor.role !== "student" || !actor.instituteId) {
    throw AppError.forbidden("This action is for students");
  }
  const [session] = await db
    .select({
      id: learningSessions.id,
      studentId: learningSessions.studentId,
      instituteId: learningSessions.instituteId,
    })
    .from(learningSessions)
    .where(eq(learningSessions.id, sessionId))
    .limit(1);
  if (!session || session.instituteId !== actor.instituteId) throw AppError.notFound("Session not found");
  if (session.studentId !== actor.id) throw AppError.forbidden("You can only open your own session");
  return session;
}
