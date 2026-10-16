CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"module_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"objectives" text NOT NULL,
	"learner_level" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"source_material" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"language_directive" text DEFAULT '' NOT NULL,
	"outline_json" jsonb NOT NULL,
	"scenes_json" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "lessons_status_check" CHECK ("lessons"."status" IN ('draft', 'published')),
	CONSTRAINT "lessons_duration_check" CHECK ("lessons"."duration_minutes" BETWEEN 5 AND 90)
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_institute_id_idx" ON "lessons" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "lessons_concept_status_idx" ON "lessons" USING btree ("concept_id","status");--> statement-breakpoint
CREATE INDEX "lessons_module_id_idx" ON "lessons" USING btree ("module_id");