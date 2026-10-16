import { z } from "zod";
import { submissionLanguages } from "@/db/schema";

export const conceptNameSchema = z.string().trim().min(1, "Name is required").max(120);

export const createConceptSchema = z.object({
  name: conceptNameSchema,
  description: z.string().trim().max(4000).optional(),
  moduleId: z.string().trim().min(1).optional(),
});

export const updateConceptSchema = z
  .object({
    name: conceptNameSchema.optional(),
    description: z.string().trim().max(4000).optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: "Provide a name or a description to update",
  });

export const prerequisiteSchema = z.object({
  requiresId: z.string().trim().min(1, "Prerequisite concept is required"),
});

const bktBound = z.number().min(0).max(1);

export const createModuleSchema = z.object({
  name: conceptNameSchema,
  goalConceptId: z.string().trim().min(1),
  masteryThreshold: bktBound.default(0.8),
  conceptIds: z.array(z.string().trim().min(1)).min(1),
});

export const questionTestSchema = z.object({
  visibility: z.enum(["visible", "hidden"]),
  input: z.string().max(20000),
  expectedOutput: z.string().max(20000),
});

export const createQuestionSchema = z.object({
  statement: z.string().trim().min(1).max(8000),
  difficulty: z.number().int().min(1).max(5),
  languages: z.array(z.enum(submissionLanguages)).min(1),
  starterCode: z.record(z.string(), z.string()).default({}),
  conceptIds: z.array(z.string().trim().min(1)).min(1),
  tests: z.array(questionTestSchema).min(1),
  status: z.enum(["draft", "published", "retired"]).default("draft"),
  referenceSolution: z.string().max(50000).optional(),
});

export const updateQuestionSchema = createQuestionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });
