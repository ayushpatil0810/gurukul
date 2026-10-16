import { z } from "zod";
import { submissionLanguages } from "@/db/schema";
import { clientEventTypes } from "@/lib/services/events";

export const startSessionSchema = z.object({
  questionId: z.string().trim().min(1),
  mode: z.enum(["practice", "graded"]),
});

export const codeSubmissionSchema = z.object({
  language: z.enum(submissionLanguages),
  code: z.string().max(64_000),
});

export const explainAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        text: z.string().max(2_000),
      }),
    )
    .min(1)
    .max(3),
});

export const eventBatchSchema = z.object({
  events: z
    .array(
      z.object({
        seq: z.number().int().positive().max(1_000_000),
        t: z.number().finite().gte(-86_400_000).lte(31_536_000_000),
        type: z.enum(clientEventTypes),
        payload: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(100),
});
