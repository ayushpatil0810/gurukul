import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type InstitutePolicy = {
  consentText: string;
  retentionDays: number;
  masteryThreshold: number;
  signalThresholds: Record<string, number>;
};

export const DEFAULT_INSTITUTE_POLICY: InstitutePolicy = {
  consentText:
    "Graded sessions record editor activity so a trainer can review how an answer was produced. Signals are evidence for a person to review. They do not change a grade or a mastery value on their own.",
  retentionDays: 180,
  masteryThreshold: 0.8,
  signalThresholds: {},
};

export const institutes = pgTable("institutes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  policyJson: jsonb("policy_json")
    .$type<InstitutePolicy>()
    .notNull()
    .default(DEFAULT_INSTITUTE_POLICY),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
