import { relations, sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { institutes } from "./institutes";

export const submissionLanguages = ["java", "javascript", "cpp"] as const;
export type SubmissionLanguage = (typeof submissionLanguages)[number];

export type BktParams = {
  pInit: number;
  learn: number;
  slip: number;
  guess: number;
};

export const DEFAULT_BKT_PARAMS: BktParams = {
  pInit: 0.2,
  learn: 0.15,
  slip: 0.1,
  guess: 0.2,
};

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

export const batches = pgTable(
  "batches",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    name: text("name").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("batches_institute_name_unique").on(table.instituteId, table.name),
    index("batches_institute_id_idx").on(table.instituteId),
  ],
);

export const batchTrainers = pgTable(
  "batch_trainers",
  {
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    trainerId: text("trainer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    instituteId: instituteColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.batchId, table.trainerId] }),
    index("batch_trainers_trainer_id_idx").on(table.trainerId),
    index("batch_trainers_institute_id_idx").on(table.instituteId),
  ],
);

export const batchMembers = pgTable(
  "batch_members",
  {
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    instituteId: instituteColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.batchId, table.studentId] }),
    index("batch_members_student_id_idx").on(table.studentId),
    index("batch_members_institute_id_idx").on(table.instituteId),
  ],
);

export const concepts = pgTable(
  "concepts",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    bktParamsJson: jsonb("bkt_params_json").$type<BktParams>().notNull().default(DEFAULT_BKT_PARAMS),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("concepts_institute_name_unique").on(table.instituteId, table.name),
    index("concepts_institute_id_idx").on(table.instituteId),
  ],
);

export const prerequisites = pgTable(
  "prerequisites",
  {
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    requiresId: text("requires_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    instituteId: instituteColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.conceptId, table.requiresId] }),
    index("prerequisites_requires_id_idx").on(table.requiresId),
    index("prerequisites_institute_id_idx").on(table.instituteId),
    check("prerequisites_no_self", sql`${table.conceptId} <> ${table.requiresId}`),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    name: text("name").notNull(),
    goalConceptId: text("goal_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "restrict" }),
    masteryThreshold: doublePrecision("mastery_threshold").notNull().default(0.8),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("modules_institute_name_unique").on(table.instituteId, table.name),
    index("modules_institute_id_idx").on(table.instituteId),
    check(
      "modules_threshold_range",
      sql`${table.masteryThreshold} >= 0 AND ${table.masteryThreshold} <= 1`,
    ),
  ],
);

export const moduleConcepts = pgTable(
  "module_concepts",
  {
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "restrict" }),
    instituteId: instituteColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.moduleId, table.conceptId] }),
    index("module_concepts_concept_id_idx").on(table.conceptId),
    index("module_concepts_institute_id_idx").on(table.instituteId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    statement: text("statement").notNull(),
    difficulty: integer("difficulty").notNull(),
    languages: jsonb("languages").$type<SubmissionLanguage[]>().notNull(),
    starterCodeJson: jsonb("starter_code_json").$type<Record<string, string>>().notNull(),
    status: text("status").notNull().default("draft"),
    referenceSolution: text("reference_solution"),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("questions_institute_id_idx").on(table.instituteId),
    index("questions_status_idx").on(table.status),
    check("questions_difficulty_range", sql`${table.difficulty} BETWEEN 1 AND 5`),
    check("questions_status_check", sql`${table.status} IN ('draft', 'published', 'retired')`),
  ],
);

export const questionConcepts = pgTable(
  "question_concepts",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "restrict" }),
    weight: doublePrecision("weight").notNull().default(1),
    instituteId: instituteColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.conceptId] }),
    index("question_concepts_concept_id_idx").on(table.conceptId),
    index("question_concepts_institute_id_idx").on(table.instituteId),
  ],
);

export const tests = pgTable(
  "tests",
  {
    id: idColumn(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    instituteId: instituteColumn(),
    visibility: text("visibility").notNull(),
    input: text("input").notNull(),
    expectedOutput: text("expected_output").notNull(),
  },
  (table) => [
    index("tests_question_id_idx").on(table.questionId),
    index("tests_institute_id_idx").on(table.instituteId),
    check("tests_visibility_check", sql`${table.visibility} IN ('visible', 'hidden')`),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    deadline: timestamp("deadline"),
    mode: text("mode").notNull(),
    attemptLimit: integer("attempt_limit"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("assignments_institute_id_idx").on(table.instituteId),
    index("assignments_batch_id_idx").on(table.batchId),
    check("assignments_mode_check", sql`${table.mode} IN ('practice', 'graded')`),
  ],
);

export const masteryState = pgTable(
  "mastery_state",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    instituteId: instituteColumn(),
    pKnow: doublePrecision("p_know").notNull(),
    confidence: doublePrecision("confidence").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.studentId, table.conceptId] }),
    index("mastery_state_institute_id_idx").on(table.instituteId),
    check("mastery_state_p_know_range", sql`${table.pKnow} >= 0 AND ${table.pKnow} <= 1`),
  ],
);

export const masteryUpdates = pgTable(
  "mastery_updates",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    before: doublePrecision("before").notNull(),
    after: doublePrecision("after").notNull(),
    causeType: text("cause_type").notNull(),
    causeId: text("cause_id"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("mastery_updates_student_id_idx").on(table.studentId),
    index("mastery_updates_institute_id_idx").on(table.instituteId),
    check(
      "mastery_updates_cause_check",
      sql`${table.causeType} IN ('attempt', 'explanation', 'decay', 'override')`,
    ),
  ],
);

export const routingDecisions = pgTable(
  "routing_decisions",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    chosenConceptId: text("chosen_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "restrict" }),
    chosenQuestionId: text("chosen_question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    alternativesJson: jsonb("alternatives_json").notNull().default([]),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("routing_decisions_student_id_idx").on(table.studentId),
    index("routing_decisions_institute_id_idx").on(table.instituteId),
  ],
);

export const consents = pgTable(
  "consents",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    policyVersion: text("policy_version").notNull(),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  },
  (table) => [
    index("consents_student_id_idx").on(table.studentId),
    index("consents_institute_id_idx").on(table.instituteId),
  ],
);

export const learningSessions = pgTable(
  "learning_sessions",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    mode: text("mode").notNull(),
    consentId: text("consent_id").references(() => consents.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    index("learning_sessions_student_id_idx").on(table.studentId),
    index("learning_sessions_institute_id_idx").on(table.instituteId),
    check("learning_sessions_mode_check", sql`${table.mode} IN ('practice', 'graded')`),
    check(
      "learning_sessions_graded_requires_consent",
      sql`${table.mode} = 'practice' OR ${table.consentId} IS NOT NULL`,
    ),
  ],
);

export const events = pgTable(
  "events",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    instituteId: instituteColumn(),
    t: doublePrecision("t").notNull(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").notNull().default({}),
    prevHash: text("prev_hash"),
    schemaVersion: integer("schema_version").notNull().default(1),
    receivedAt: timestamp("received_at"),
    chainIndex: integer("chain_index").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.seq] }),
    uniqueIndex("events_session_chain_idx").on(table.sessionId, table.chainIndex),
    index("events_institute_id_idx").on(table.instituteId),
  ],
);

export const snapshots = pgTable(
  "snapshots",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    instituteId: instituteColumn(),
    t: doublePrecision("t").notNull(),
    documentText: text("document_text").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.seq] }),
    index("snapshots_institute_id_idx").on(table.instituteId),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    sessionId: text("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    language: text("language").notNull(),
    code: text("code").notNull(),
    resultJson: jsonb("result_json"),
    passRate: doublePrecision("pass_rate"),
    sandboxLog: text("sandbox_log"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("attempts_session_id_idx").on(table.sessionId),
    index("attempts_institute_id_idx").on(table.instituteId),
    check("attempts_kind_check", sql`${table.kind} IN ('run', 'submit')`),
  ],
);

export const signals = pgTable(
  "signals",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    sessionId: text("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    strength: text("strength").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    tStart: doublePrecision("t_start").notNull(),
    tEnd: doublePrecision("t_end").notNull(),
    metricsJson: jsonb("metrics_json").notNull(),
    explanation: text("explanation").notNull(),
    contextJson: jsonb("context_json").notNull().default([]),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("signals_session_id_idx").on(table.sessionId),
    index("signals_institute_id_idx").on(table.instituteId),
    check(
      "signals_type_check",
      sql`${table.type} IN ('large_paste', 'faster_than_rhythm', 'no_write_run_fix', 'evenly_typed', 'explanation_mismatch')`,
    ),
    check("signals_strength_check", sql`${table.strength} IN ('low', 'medium', 'high')`),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    signalId: text("signal_id")
      .notNull()
      .references(() => signals.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    disposition: text("disposition").notNull(),
    note: text("note").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("reviews_signal_id_idx").on(table.signalId),
    index("reviews_institute_id_idx").on(table.instituteId),
    check(
      "reviews_disposition_check",
      sql`${table.disposition} IN ('dismissed', 'needs_viva', 'escalate')`,
    ),
    check("reviews_note_not_blank", sql`char_length(trim(${table.note})) > 0`),
  ],
);

export const explainQa = pgTable(
  "explain_qa",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    type: text("type").notNull(),
    codeRefs: jsonb("code_refs").notNull().default([]),
    answerText: text("answer_text"),
    verdict: text("verdict"),
    evidenceJson: jsonb("evidence_json"),
    overruledBy: text("overruled_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("explain_qa_attempt_id_idx").on(table.attemptId),
    index("explain_qa_institute_id_idx").on(table.instituteId),
    check(
      "explain_qa_verdict_check",
      sql`${table.verdict} IS NULL OR ${table.verdict} IN ('yes', 'partial', 'no')`,
    ),
  ],
);

export const overrides = pgTable(
  "overrides",
  {
    id: idColumn(),
    instituteId: instituteColumn(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    note: text("note").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("overrides_actor_id_idx").on(table.actorId),
    index("overrides_institute_id_idx").on(table.instituteId),
  ],
);

export const batchRelations = relations(batches, ({ one, many }) => ({
  institute: one(institutes, { fields: [batches.instituteId], references: [institutes.id] }),
  trainers: many(batchTrainers),
  members: many(batchMembers),
}));

export const conceptRelations = relations(concepts, ({ one, many }) => ({
  institute: one(institutes, { fields: [concepts.instituteId], references: [institutes.id] }),
  prerequisites: many(prerequisites, { relationName: "conceptPrerequisites" }),
  requiredBy: many(prerequisites, { relationName: "requiredBy" }),
}));

export const prerequisiteRelations = relations(prerequisites, ({ one }) => ({
  concept: one(concepts, {
    fields: [prerequisites.conceptId],
    references: [concepts.id],
    relationName: "conceptPrerequisites",
  }),
  requires: one(concepts, {
    fields: [prerequisites.requiresId],
    references: [concepts.id],
    relationName: "requiredBy",
  }),
}));

export const questionRelations = relations(questions, ({ one, many }) => ({
  institute: one(institutes, { fields: [questions.instituteId], references: [institutes.id] }),
  tests: many(tests),
  concepts: many(questionConcepts),
}));

export const testRelations = relations(tests, ({ one }) => ({
  question: one(questions, { fields: [tests.questionId], references: [questions.id] }),
}));
