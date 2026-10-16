import { z } from "zod";
import { submissionLanguages } from "@/db/schema";

export const startSessionSchema = z.object({
  questionId: z.string().trim().min(1),
  mode: z.enum(["practice", "graded"]),
});

export const codeSubmissionSchema = z.object({
  language: z.enum(submissionLanguages),
  code: z.string().max(64_000),
});
