CREATE TABLE "explain_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"attempt_id" text NOT NULL,
	"session_id" text NOT NULL,
	"student_id" text NOT NULL,
	"language" text NOT NULL,
	"code_snapshot" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp,
	CONSTRAINT "explain_sets_status_check" CHECK ("explain_sets"."status" IN ('open', 'answered', 'unavailable'))
);
--> statement-breakpoint
ALTER TABLE "explain_qa" ADD COLUMN "missed_points" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD COLUMN "confidence" double precision;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD COLUMN "review_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD COLUMN "grader_json" jsonb;--> statement-breakpoint
ALTER TABLE "explain_qa" ADD COLUMN "answered_at" timestamp;--> statement-breakpoint
ALTER TABLE "explain_sets" ADD CONSTRAINT "explain_sets_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explain_sets" ADD CONSTRAINT "explain_sets_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explain_sets" ADD CONSTRAINT "explain_sets_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explain_sets" ADD CONSTRAINT "explain_sets_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "explain_sets_attempt_id_unique" ON "explain_sets" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "explain_sets_session_id_idx" ON "explain_sets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "explain_sets_institute_id_idx" ON "explain_sets" USING btree ("institute_id");--> statement-breakpoint
ALTER TABLE "explain_qa" ADD CONSTRAINT "explain_qa_type_check" CHECK ("explain_qa"."type" IN ('trace', 'edge', 'reasoning', 'mutation'));--> statement-breakpoint
ALTER TABLE "explain_qa" ADD CONSTRAINT "explain_qa_review_status_check" CHECK ("explain_qa"."review_status" IN ('none', 'needs_review'));--> statement-breakpoint
ALTER TABLE "explain_qa" ADD CONSTRAINT "explain_qa_method_check" CHECK ("explain_qa"."method" IS NULL OR "explain_qa"."method" IN ('sandbox', 'facts', 'none'));