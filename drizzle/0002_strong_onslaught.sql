ALTER TABLE "events" ADD COLUMN "schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "received_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "chain_index" integer;--> statement-breakpoint
UPDATE "events" SET "chain_index" = "seq" WHERE "chain_index" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "chain_index" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "events_session_chain_idx" ON "events" USING btree ("session_id","chain_index");