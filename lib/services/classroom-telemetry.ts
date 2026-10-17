import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classroomEvents, learningSessions, lessons } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import {
  type ClassroomEventItemInput,
  sanitizeAndValidateClassroomPayload,
} from "@/lib/validations/classroom-telemetry";
import { appendEvents, type AppendResult, type IncomingEvent } from "./events";

let tableEnsured = false;

export async function ensureClassroomEventsTable() {
  if (tableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS classroom_events (
        id TEXT PRIMARY KEY,
        institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        session_id TEXT,
        session_valid BOOLEAN NOT NULL DEFAULT false,
        invalid_reason TEXT,
        scene_id TEXT,
        seq INTEGER NOT NULL,
        t DOUBLE PRECISION NOT NULL,
        type TEXT NOT NULL,
        payload_json JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS classroom_events_student_id_idx ON classroom_events (student_id);
      CREATE INDEX IF NOT EXISTS classroom_events_institute_id_idx ON classroom_events (institute_id);
      CREATE INDEX IF NOT EXISTS classroom_events_lesson_id_idx ON classroom_events (lesson_id);
      CREATE INDEX IF NOT EXISTS classroom_events_session_id_idx ON classroom_events (session_id);
      CREATE INDEX IF NOT EXISTS classroom_events_type_idx ON classroom_events (type);
      CREATE INDEX IF NOT EXISTS classroom_events_created_at_idx ON classroom_events (created_at);
    `);
    tableEnsured = true;
  } catch {
    // If table already exists or concurrently created, continue
    tableEnsured = true;
  }
}

export type RecordClassroomTelemetryResult = {
  received: number;
  recorded: number;
  acked: number[];
  sessionValid: boolean;
  invalidReason: string | null;
  sessionAppend?: AppendResult;
};

export async function recordClassroomTelemetry(
  actor: Actor,
  lessonId: string,
  incomingEvents: ClassroomEventItemInput[],
  sessionId?: string | null,
): Promise<RecordClassroomTelemetryResult> {
  if (actor.role !== "student" || !actor.instituteId) {
    throw AppError.forbidden("Classroom telemetry is recorded for students");
  }

  await ensureClassroomEventsTable();

  // Verify lesson access in student's institute
  const [lessonRow] = await db
    .select({
      id: lessons.id,
      instituteId: lessons.instituteId,
      status: lessons.status,
    })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (!lessonRow || lessonRow.instituteId !== actor.instituteId || lessonRow.status !== "published") {
    throw AppError.notFound("Lesson not found");
  }

  // Session ownership & context evaluation
  let sessionValid = false;
  let invalidReason: string | null = null;
  let verifiedSession: typeof learningSessions.$inferSelect | null = null;

  if (sessionId && sessionId.trim().length > 0) {
    const [session] = await db
      .select()
      .from(learningSessions)
      .where(eq(learningSessions.id, sessionId))
      .limit(1);

    if (!session) {
      sessionValid = false;
      invalidReason = "session_not_found";
    } else if (session.instituteId !== actor.instituteId) {
      sessionValid = false;
      invalidReason = "cross_institute_session_mismatch";
    } else if (session.studentId !== actor.id) {
      // Cross-student session injection attempt - strictly rejected from writing to target session
      sessionValid = false;
      invalidReason = "cross_student_ownership_mismatch";
    } else {
      sessionValid = true;
      invalidReason = null;
      verifiedSession = session;
    }
  } else {
    sessionValid = false;
    invalidReason = "missing_session_context";
  }

  // Deduplication check for lesson_complete
  let existingCompletion = false;
  if (incomingEvents.some((e) => e.type === "lesson_complete")) {
    const [comp] = await db
      .select({ id: classroomEvents.id })
      .from(classroomEvents)
      .where(
        and(
          eq(classroomEvents.studentId, actor.id),
          eq(classroomEvents.lessonId, lessonId),
          eq(classroomEvents.type, "lesson_complete"),
        ),
      )
      .limit(1);
    existingCompletion = Boolean(comp);
  }

  const sanitizedRows: (typeof classroomEvents.$inferInsert)[] = [];
  const ackedSeqs: number[] = [];

  for (const event of incomingEvents) {
    // Avoid duplicate lesson completion events
    if (event.type === "lesson_complete" && existingCompletion) {
      ackedSeqs.push(event.seq);
      continue;
    }

    const cleanedPayload = sanitizeAndValidateClassroomPayload(event.type, event.payload);

    sanitizedRows.push({
      instituteId: actor.instituteId,
      studentId: actor.id,
      lessonId,
      sessionId: sessionId?.trim() || null,
      sessionValid,
      invalidReason,
      sceneId: event.sceneId?.trim() || null,
      seq: event.seq,
      t: event.t,
      type: event.type,
      payloadJson: cleanedPayload,
    });

    ackedSeqs.push(event.seq);
    if (event.type === "lesson_complete") {
      existingCompletion = true;
    }
  }

  if (sanitizedRows.length > 0) {
    await db.insert(classroomEvents).values(sanitizedRows);
  }

  // If session is valid and owned by this student, also append to hash-chained timeline
  let sessionAppendResult: AppendResult | undefined;
  if (sessionValid && verifiedSession && sanitizedRows.length > 0) {
    try {
      const incomingChainEvents: IncomingEvent[] = sanitizedRows.map((row) => ({
        seq: row.seq,
        t: row.t,
        type: row.type as IncomingEvent["type"],
        payload: (row.payloadJson as Record<string, unknown>) ?? {},
      }));

      sessionAppendResult = await appendEvents(actor, verifiedSession.id, incomingChainEvents);
    } catch {
      // Ingestion into classroomEvents is already persisted; timeline append is best-effort secondary channel
    }
  }

  return {
    received: incomingEvents.length,
    recorded: sanitizedRows.length,
    acked: ackedSeqs,
    sessionValid,
    invalidReason,
    sessionAppend: sessionAppendResult,
  };
}

export async function listClassroomEventsForStudent(
  actor: Actor,
  lessonId?: string,
) {
  if (actor.role !== "student" || !actor.instituteId) {
    throw AppError.forbidden("Access denied");
  }

  await ensureClassroomEventsTable();

  const conditions = [
    eq(classroomEvents.studentId, actor.id),
    eq(classroomEvents.instituteId, actor.instituteId),
  ];

  if (lessonId) {
    conditions.push(eq(classroomEvents.lessonId, lessonId));
  }

  return db
    .select()
    .from(classroomEvents)
    .where(and(...conditions))
    .orderBy(desc(classroomEvents.createdAt));
}
