import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { concepts, modules } from "./portal";
import { institutes } from "./institutes";

function idColumn() {
  return text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
}

/**
 * Trainer-authored lesson for one concept. Outline and scenes are OpenMAIC
 * documents. Drafts stay off student reads. Viewing a row does not touch mastery.
 */
export const lessons = pgTable(
  "lessons",
  {
    id: idColumn(),
    instituteId: text("institute_id")
      .notNull()
      .references(() => institutes.id, { onDelete: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "restrict" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "restrict" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    topic: text("topic").notNull(),
    objectives: text("objectives").notNull(),
    learnerLevel: text("learner_level").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    sourceMaterial: text("source_material").notNull().default(""),
    status: text("status").notNull().default("draft"),
    languageDirective: text("language_directive").notNull().default(""),
    outlineJson: jsonb("outline_json").notNull(),
    scenesJson: jsonb("scenes_json"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    publishedAt: timestamp("published_at"),
  },
  (table) => [
    index("lessons_institute_id_idx").on(table.instituteId),
    index("lessons_concept_status_idx").on(table.conceptId, table.status),
    index("lessons_module_id_idx").on(table.moduleId),
    check("lessons_status_check", sql`${table.status} IN ('draft', 'published')`),
    check("lessons_duration_check", sql`${table.durationMinutes} BETWEEN 5 AND 90`),
  ],
);
