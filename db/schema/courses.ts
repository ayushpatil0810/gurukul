import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { institutes } from "./institutes";
import { batches, concepts, modules } from "./portal";

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
 * Top-level Course entity managed by trainers and admins.
 * Aggregates modules, sections, competencies, and assigned batches.
 */
export const courses = pgTable(
  "courses",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    name: text("name").notNull(),
    code: text("code").notNull(), // e.g. "TS-101", "DEV-202"
    description: text("description").notNull().default(""),
    level: text("level").notNull().default("intermediate"), // beginner | intermediate | advanced
    status: text("status").notNull().default("draft"), // draft | published | archived
    masteryThreshold: doublePrecision("mastery_threshold").notNull().default(0.8),
    goalConceptId: text("goal_concept_id").references(() => concepts.id, { onDelete: "set null" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("courses_institute_code_unique").on(table.instituteId, table.code),
    index("courses_institute_id_idx").on(table.instituteId),
    index("courses_status_idx").on(table.status),
    index("courses_created_by_idx").on(table.createdBy),
    check("courses_status_check", sql`${table.status} IN ('draft', 'published', 'archived')`),
    check("courses_level_check", sql`${table.level} IN ('beginner', 'intermediate', 'advanced')`),
    check(
      "courses_threshold_range",
      sql`${table.masteryThreshold} >= 0 AND ${table.masteryThreshold} <= 1`,
    ),
  ],
);

/**
 * Ordered relationship between Courses and Modules.
 */
export const courseModules = pgTable(
  "course_modules",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    instituteId: instituteColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.courseId, table.moduleId] }),
    index("course_modules_module_id_idx").on(table.moduleId),
    index("course_modules_institute_id_idx").on(table.instituteId),
  ],
);

/**
 * Sections within Modules (e.g. "Section 1: Syntax", "Section 2: Functions").
 */
export const sections = pgTable(
  "sections",
  {
    id: idColumn(),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    instituteId: instituteColumn(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("sections_module_id_idx").on(table.moduleId),
    index("sections_institute_id_idx").on(table.instituteId),
  ],
);

/**
 * Maps Concepts to specific Sections.
 */
export const sectionConcepts = pgTable(
  "section_concepts",
  {
    sectionId: text("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    instituteId: instituteColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.sectionId, table.conceptId] }),
    index("section_concepts_concept_id_idx").on(table.conceptId),
    index("section_concepts_institute_id_idx").on(table.instituteId),
  ],
);

/**
 * Assigns Courses to Cohort Batches.
 */
export const courseBatches = pgTable(
  "course_batches",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    instituteId: instituteColumn(),
    assignedAt: createdAtColumn(),
    deadline: timestamp("deadline"),
  },
  (table) => [
    primaryKey({ columns: [table.courseId, table.batchId] }),
    index("course_batches_batch_id_idx").on(table.batchId),
    index("course_batches_institute_id_idx").on(table.instituteId),
  ],
);
