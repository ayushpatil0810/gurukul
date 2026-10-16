CREATE TABLE "integrity_runs" (
	"session_id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"rule_version" text NOT NULL,
	"withheld_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_note_not_blank";--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_disposition_check";--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "student_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "seq_start" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "seq_end" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "evidence_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "limitations_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "rule_version" text NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "dedupe_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "review_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "supported" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "integrity_runs" ADD CONSTRAINT "integrity_runs_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_runs" ADD CONSTRAINT "integrity_runs_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integrity_runs_institute_id_idx" ON "integrity_runs" USING btree ("institute_id");--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signals_session_dedupe_unique" ON "signals" USING btree ("session_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "signals_student_id_idx" ON "signals" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "signals_review_status_idx" ON "signals" USING btree ("review_status");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_escalated_note" CHECK ("reviews"."disposition" <> 'escalated' OR char_length(trim("reviews"."note")) > 0);--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_disposition_check" CHECK ("reviews"."disposition" IN ('dismissed', 'needs_viva', 'escalated'));--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_review_status_check" CHECK ("signals"."review_status" IN ('pending', 'dismissed', 'needs_viva', 'escalated'));