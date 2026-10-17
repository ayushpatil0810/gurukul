import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { institutes } from "./institutes";
import { lessons } from "./lessons";

function idColumn() {
  return text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
}

function instituteColumn() {
  return text("institute_id")
    .notNull()
    .references(() => institutes.id, { onDelete: "cascade" });
}

function createdAtColumn() {
  return timestamp("created_at").defaultNow().notNull();
}

/**
 * Classroom interaction telemetry events for interactive lessons.
 * Stores privacy-conscious events (navigation, simulation actions, mentor usage, knowledge-checks).
 * Never mutates BKT mastery, grades, or integrity review state.
 */
export const classroomEvents = pgTable(
  "classroom_events",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    sessionValid: boolean("session_valid").notNull().default(false),
    invalidReason: text("invalid_reason"),
    sceneId: text("scene_id"),
    seq: integer("seq").notNull(),
    t: doublePrecision("t").notNull(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").notNull().default({}),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("classroom_events_student_id_idx").on(table.studentId),
    index("classroom_events_institute_id_idx").on(table.instituteId),
    index("classroom_events_lesson_id_idx").on(table.lessonId),
    index("classroom_events_session_id_idx").on(table.sessionId),
    index("classroom_events_type_idx").on(table.type),
    index("classroom_events_created_at_idx").on(table.createdAt),
  ],
);
