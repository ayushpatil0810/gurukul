CREATE TABLE "classroom_events" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"student_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"session_id" text,
	"session_valid" boolean DEFAULT false NOT NULL,
	"invalid_reason" text,
	"scene_id" text,
	"seq" integer NOT NULL,
	"t" double precision NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_batches" (
	"course_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"institute_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deadline" timestamp,
	CONSTRAINT "course_batches_course_id_batch_id_pk" PRIMARY KEY("course_id","batch_id")
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"course_id" text NOT NULL,
	"module_id" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"institute_id" text NOT NULL,
	CONSTRAINT "course_modules_course_id_module_id_pk" PRIMARY KEY("course_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"level" text DEFAULT 'intermediate' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"mastery_threshold" double precision DEFAULT 0.8 NOT NULL,
	"goal_concept_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "courses_status_check" CHECK ("courses"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "courses_level_check" CHECK ("courses"."level" IN ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT "courses_threshold_range" CHECK ("courses"."mastery_threshold" >= 0 AND "courses"."mastery_threshold" <= 1)
);
--> statement-breakpoint
CREATE TABLE "section_concepts" (
	"section_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"institute_id" text NOT NULL,
	CONSTRAINT "section_concepts_section_id_concept_id_pk" PRIMARY KEY("section_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"institute_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classroom_events" ADD CONSTRAINT "classroom_events_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_events" ADD CONSTRAINT "classroom_events_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_events" ADD CONSTRAINT "classroom_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_batches" ADD CONSTRAINT "course_batches_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_batches" ADD CONSTRAINT "course_batches_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_batches" ADD CONSTRAINT "course_batches_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_goal_concept_id_concepts_id_fk" FOREIGN KEY ("goal_concept_id") REFERENCES "public"."concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_concepts" ADD CONSTRAINT "section_concepts_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_concepts" ADD CONSTRAINT "section_concepts_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_concepts" ADD CONSTRAINT "section_concepts_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classroom_events_student_id_idx" ON "classroom_events" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "classroom_events_institute_id_idx" ON "classroom_events" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "classroom_events_lesson_id_idx" ON "classroom_events" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "classroom_events_session_id_idx" ON "classroom_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "classroom_events_type_idx" ON "classroom_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "classroom_events_created_at_idx" ON "classroom_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "course_batches_batch_id_idx" ON "course_batches" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "course_batches_institute_id_idx" ON "course_batches" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "course_modules_module_id_idx" ON "course_modules" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "course_modules_institute_id_idx" ON "course_modules" USING btree ("institute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_institute_code_unique" ON "courses" USING btree ("institute_id","code");--> statement-breakpoint
CREATE INDEX "courses_institute_id_idx" ON "courses" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "courses_status_idx" ON "courses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "courses_created_by_idx" ON "courses" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "section_concepts_concept_id_idx" ON "section_concepts" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "section_concepts_institute_id_idx" ON "section_concepts" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "sections_module_id_idx" ON "sections" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "sections_institute_id_idx" ON "sections" USING btree ("institute_id");