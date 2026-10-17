import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, learningSessions } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { planEventAppend, seqsToAcknowledge, type TimelineEvent } from "@/lib/engine/event-chain";
import { gradedRecordingAllowed, sanitizeClientPayload } from "@/lib/engine/event-payload";
import { AppError } from "@/lib/errors";

export const classroomEventTypes = [
  "lesson_start",
  "lesson_complete",
  "scene_view",
  "scene_nav",
  "diagram_node_inspect",
  "stepper_step",
  "walkthrough_step",
  "docker_lab_action",
  "cicd_lab_run",
  "k8s_lab_action",
  "quiz_submit",
  "quiz_retry",
  "mentor_open",
  "mentor_action",
  "mentor_reply",
  "recommendation_view",
  "recommendation_click",
] as const;

export type ClassroomEventType = (typeof classroomEventTypes)[number];

export const clientEventTypes = [
  "session_start",
  "session_end",
  "insert",
  "delete",
  "replace",
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
  ...classroomEventTypes,
] as const;

export type ClientEventType = (typeof clientEventTypes)[number];

export type IncomingEvent = {
  seq: number;
  t: number;
  type: ClientEventType;
  payload: Record<string, unknown>;
};

export type StoredEvent = TimelineEvent & {
  receivedAt: string | null;
};

export type AppendResult = {
  events: StoredEvent[];
  acked: number[];
};

export async function appendEvents(actor: Actor, sessionId: string, incoming: IncomingEvent[]): Promise<AppendResult> {
  const session = await ownedSession(actor, sessionId);
  if (!gradedRecordingAllowed(session)) {
    throw AppError.conflict("Record consent before recording a graded session.");
  }

  const receivedAt = new Date();
  const appended = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from learning_sessions where id = ${sessionId} for update`);
    const existing = await readEvents(tx, sessionId);
    const planned = planEventAppend(
      existing,
      incoming.map((event) => ({
        seq: event.seq,
        t: event.t,
        type: event.type,
        payload: sanitizeClientPayload(event.payload),
      })),
    );
    if (planned.length > 0) {
      await tx
        .insert(events)
        .values(
          planned.map((event) => ({
            sessionId,
            seq: event.seq,
            instituteId: session.instituteId,
            t: event.t,
            type: event.type,
            payloadJson: (event.payload ?? {}) as Record<string, unknown>,
            prevHash: event.prevHash,
            schemaVersion: event.schemaVersion,
            receivedAt,
            chainIndex: event.chainIndex,
          })),
        )
        .onConflictDoNothing();
    }
    const stored = await readEvents(tx, sessionId);
    return {
      events: stored,
      acked: seqsToAcknowledge(stored, incoming.map((event) => event.seq)),
    };
  });
  await refreshGradedSignals(session);
  return appended;
}

async function refreshGradedSignals(session: { id: string; mode: string }) {
  if (session.mode !== "graded") return;
  const { persistSessionSignals } = await import("@/lib/services/integrity");
  await persistSessionSignals(session.id);
}

export async function listEvents(actor: Actor, sessionId: string): Promise<StoredEvent[]> {
  await ownedSession(actor, sessionId);
  return readEvents(db, sessionId);
}

async function readEvents(
  database: Pick<typeof db, "select">,
  sessionId: string,
): Promise<StoredEvent[]> {
  const rows = await database
    .select({
      seq: events.seq,
      t: events.t,
      type: events.type,
      payload: events.payloadJson,
      prevHash: events.prevHash,
      schemaVersion: events.schemaVersion,
      receivedAt: events.receivedAt,
      chainIndex: events.chainIndex,
    })
    .from(events)
    .where(eq(events.sessionId, sessionId))
    .orderBy(asc(events.chainIndex));
  return rows.map((row) => ({
    seq: row.seq,
    t: row.t,
    type: row.type,
    payload: row.payload,
    prevHash: row.prevHash,
    schemaVersion: row.schemaVersion,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    chainIndex: row.chainIndex,
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
      mode: learningSessions.mode,
      consentId: learningSessions.consentId,
    })
    .from(learningSessions)
    .where(eq(learningSessions.id, sessionId))
    .limit(1);
  if (!session || session.instituteId !== actor.instituteId) throw AppError.notFound("Session not found");
  if (session.studentId !== actor.id) throw AppError.forbidden("You can only open your own session");
  return session;
}
