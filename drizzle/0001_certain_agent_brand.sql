CREATE TABLE "institutes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"policy_json" jsonb DEFAULT '{"consentText":"Graded sessions record editor activity so a trainer can review how an answer was produced. Signals are evidence for a person to review. They do not change a grade or a mastery value on their own.","retentionDays":180,"masteryThreshold":0.8,"signalThresholds":{}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"module_id" text NOT NULL,
	"deadline" timestamp,
	"mode" text NOT NULL,
	"attempt_limit" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_mode_check" CHECK ("assignments"."mode" IN ('practice', 'graded'))
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"code" text NOT NULL,
	"result_json" jsonb,
	"pass_rate" double precision,
	"sandbox_log" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_kind_check" CHECK ("attempts"."kind" IN ('run', 'submit'))
);
--> statement-breakpoint
CREATE TABLE "batch_members" (
	"batch_id" text NOT NULL,
	"student_id" text NOT NULL,
	"institute_id" text NOT NULL,
	CONSTRAINT "batch_members_batch_id_student_id_pk" PRIMARY KEY("batch_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "batch_trainers" (
	"batch_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"institute_id" text NOT NULL,
	CONSTRAINT "batch_trainers_batch_id_trainer_id_pk" PRIMARY KEY("batch_id","trainer_id")
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"bkt_params_json" jsonb DEFAULT '{"pInit":0.2,"learn":0.15,"slip":0.1,"guess":0.2}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"student_id" text NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"institute_id" text NOT NULL,
	"t" double precision NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text,
	CONSTRAINT "events_session_id_seq_pk" PRIMARY KEY("session_id","seq")
);
--> statement-breakpoint
CREATE TABLE "explain_qa" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"attempt_id" text NOT NULL,
	"question_text" text NOT NULL,
	"type" text NOT NULL,
	"code_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer_text" text,
	"verdict" text,
	"evidence_json" jsonb,
	"overruled_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "explain_qa_verdict_check" CHECK ("explain_qa"."verdict" IS NULL OR "explain_qa"."verdict" IN ('yes', 'partial', 'no'))
);
--> statement-breakpoint
CREATE TABLE "learning_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"student_id" text NOT NULL,
	"question_id" text NOT NULL,
	"mode" text NOT NULL,
	"consent_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	CONSTRAINT "learning_sessions_mode_check" CHECK ("learning_sessions"."mode" IN ('practice', 'graded')),
	CONSTRAINT "learning_sessions_graded_requires_consent" CHECK ("learning_sessions"."mode" = 'practice' OR "learning_sessions"."consent_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "mastery_state" (
	"student_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"institute_id" text NOT NULL,
	"p_know" double precision NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mastery_state_student_id_concept_id_pk" PRIMARY KEY("student_id","concept_id"),
	CONSTRAINT "mastery_state_p_know_range" CHECK ("mastery_state"."p_know" >= 0 AND "mastery_state"."p_know" <= 1)
);
--> statement-breakpoint
CREATE TABLE "mastery_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"student_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"before" double precision NOT NULL,
	"after" double precision NOT NULL,
	"cause_type" text NOT NULL,
	"cause_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mastery_updates_cause_check" CHECK ("mastery_updates"."cause_type" IN ('attempt', 'explanation', 'decay', 'override'))
);
--> statement-breakpoint
CREATE TABLE "module_concepts" (
	"module_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"institute_id" text NOT NULL,
	CONSTRAINT "module_concepts_module_id_concept_id_pk" PRIMARY KEY("module_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"name" text NOT NULL,
	"goal_concept_id" text NOT NULL,
	"mastery_threshold" double precision DEFAULT 0.8 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "modules_threshold_range" CHECK ("modules"."mastery_threshold" >= 0 AND "modules"."mastery_threshold" <= 1)
);
--> statement-breakpoint
CREATE TABLE "overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"action" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prerequisites" (
	"concept_id" text NOT NULL,
	"requires_id" text NOT NULL,
	"institute_id" text NOT NULL,
	CONSTRAINT "prerequisites_concept_id_requires_id_pk" PRIMARY KEY("concept_id","requires_id"),
	CONSTRAINT "prerequisites_no_self" CHECK ("prerequisites"."concept_id" <> "prerequisites"."requires_id")
);
--> statement-breakpoint
CREATE TABLE "question_concepts" (
	"question_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"institute_id" text NOT NULL,
	CONSTRAINT "question_concepts_question_id_concept_id_pk" PRIMARY KEY("question_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"statement" text NOT NULL,
	"difficulty" integer NOT NULL,
	"languages" jsonb NOT NULL,
	"starter_code_json" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reference_solution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "questions_difficulty_range" CHECK ("questions"."difficulty" BETWEEN 1 AND 5),
	CONSTRAINT "questions_status_check" CHECK ("questions"."status" IN ('draft', 'published', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"signal_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"disposition" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_disposition_check" CHECK ("reviews"."disposition" IN ('dismissed', 'needs_viva', 'escalate')),
	CONSTRAINT "reviews_note_not_blank" CHECK (char_length(trim("reviews"."note")) > 0)
);
--> statement-breakpoint
CREATE TABLE "routing_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"student_id" text NOT NULL,
	"module_id" text NOT NULL,
	"chosen_concept_id" text NOT NULL,
	"chosen_question_id" text,
	"reason" text NOT NULL,
	"alternatives_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"strength" text NOT NULL,
	"confidence" double precision NOT NULL,
	"t_start" double precision NOT NULL,
	"t_end" double precision NOT NULL,
	"metrics_json" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"context_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "signals_type_check" CHECK ("signals"."type" IN ('large_paste', 'faster_than_rhythm', 'no_write_run_fix', 'evenly_typed', 'explanation_mismatch')),
	CONSTRAINT "signals_strength_check" CHECK ("signals"."strength" IN ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"institute_id" text NOT NULL,
	"t" double precision NOT NULL,
	"document_text" text NOT NULL,
	CONSTRAINT "snapshots_session_id_seq_pk" PRIMARY KEY("session_id","seq")
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"institute_id" text NOT NULL,
	"visibility" text NOT NULL,
	"input" text NOT NULL,
	"expected_output" text NOT NULL,
	CONSTRAINT "tests_visibility_check" CHECK ("tests"."visibility" IN ('visible', 'hidden'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "institute_id" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_members" ADD CONSTRAINT "batch_members_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_members" ADD CONSTRAINT "batch_members_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_members" ADD CONSTRAINT "batch_members_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_trainers" ADD CONSTRAINT "batch_trainers_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_trainers" ADD CONSTRAINT "batch_trainers_trainer_id_user_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_trainers" ADD CONSTRAINT "batch_trainers_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD CONSTRAINT "explain_qa_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD CONSTRAINT "explain_qa_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD CONSTRAINT "explain_qa_overruled_by_user_id_fk" FOREIGN KEY ("overruled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_consent_id_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_state" ADD CONSTRAINT "mastery_state_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_state" ADD CONSTRAINT "mastery_state_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_state" ADD CONSTRAINT "mastery_state_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_updates" ADD CONSTRAINT "mastery_updates_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_updates" ADD CONSTRAINT "mastery_updates_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_updates" ADD CONSTRAINT "mastery_updates_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_concepts" ADD CONSTRAINT "module_concepts_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_concepts" ADD CONSTRAINT "module_concepts_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_concepts" ADD CONSTRAINT "module_concepts_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_goal_concept_id_concepts_id_fk" FOREIGN KEY ("goal_concept_id") REFERENCES "public"."concepts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisites" ADD CONSTRAINT "prerequisites_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisites" ADD CONSTRAINT "prerequisites_requires_id_concepts_id_fk" FOREIGN KEY ("requires_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisites" ADD CONSTRAINT "prerequisites_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_concepts" ADD CONSTRAINT "question_concepts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_concepts" ADD CONSTRAINT "question_concepts_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_concepts" ADD CONSTRAINT "question_concepts_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_chosen_concept_id_concepts_id_fk" FOREIGN KEY ("chosen_concept_id") REFERENCES "public"."concepts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_chosen_question_id_questions_id_fk" FOREIGN KEY ("chosen_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_institute_id_idx" ON "assignments" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "assignments_batch_id_idx" ON "assignments" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "attempts_session_id_idx" ON "attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "attempts_institute_id_idx" ON "attempts" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "batch_members_student_id_idx" ON "batch_members" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "batch_members_institute_id_idx" ON "batch_members" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "batch_trainers_trainer_id_idx" ON "batch_trainers" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "batch_trainers_institute_id_idx" ON "batch_trainers" USING btree ("institute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "batches_institute_name_unique" ON "batches" USING btree ("institute_id","name");--> statement-breakpoint
CREATE INDEX "batches_institute_id_idx" ON "batches" USING btree ("institute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "concepts_institute_name_unique" ON "concepts" USING btree ("institute_id","name");--> statement-breakpoint
CREATE INDEX "concepts_institute_id_idx" ON "concepts" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "consents_student_id_idx" ON "consents" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "consents_institute_id_idx" ON "consents" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "events_institute_id_idx" ON "events" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "explain_qa_attempt_id_idx" ON "explain_qa" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "explain_qa_institute_id_idx" ON "explain_qa" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "learning_sessions_student_id_idx" ON "learning_sessions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "learning_sessions_institute_id_idx" ON "learning_sessions" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "mastery_state_institute_id_idx" ON "mastery_state" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "mastery_updates_student_id_idx" ON "mastery_updates" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "mastery_updates_institute_id_idx" ON "mastery_updates" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "module_concepts_concept_id_idx" ON "module_concepts" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "module_concepts_institute_id_idx" ON "module_concepts" USING btree ("institute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_institute_name_unique" ON "modules" USING btree ("institute_id","name");--> statement-breakpoint
CREATE INDEX "modules_institute_id_idx" ON "modules" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "overrides_actor_id_idx" ON "overrides" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "overrides_institute_id_idx" ON "overrides" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "prerequisites_requires_id_idx" ON "prerequisites" USING btree ("requires_id");--> statement-breakpoint
CREATE INDEX "prerequisites_institute_id_idx" ON "prerequisites" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "question_concepts_concept_id_idx" ON "question_concepts" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "question_concepts_institute_id_idx" ON "question_concepts" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "questions_institute_id_idx" ON "questions" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "questions_status_idx" ON "questions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reviews_signal_id_idx" ON "reviews" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "reviews_institute_id_idx" ON "reviews" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "routing_decisions_student_id_idx" ON "routing_decisions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "routing_decisions_institute_id_idx" ON "routing_decisions" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "signals_session_id_idx" ON "signals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "signals_institute_id_idx" ON "signals" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "snapshots_institute_id_idx" ON "snapshots" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "tests_question_id_idx" ON "tests" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "tests_institute_id_idx" ON "tests" USING btree ("institute_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_institute_id_idx" ON "user" USING btree ("institute_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("user"."role" IN ('student', 'trainer', 'admin'));