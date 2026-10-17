import { z } from "zod";

const courseNameSchema = z.string().trim().min(1, "Course title is required").max(140);
const courseCodeSchema = z
  .string()
  .trim()
  .min(1, "Course code is required")
  .max(40)
  .regex(/^[A-Za-z0-9-_]+$/, "Course code may only contain letters, numbers, hyphens, and underscores");

const bktBound = z.number().min(0).max(1);

export const createCourseSchema = z.object({
  name: courseNameSchema,
  code: courseCodeSchema,
  description: z.string().trim().max(4000).optional().default(""),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  masteryThreshold: bktBound.default(0.8),
  goalConceptId: z.string().trim().min(1).optional().nullable(),
  batchIds: z.array(z.string().trim().min(1)).optional().default([]),
  moduleIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export const updateCourseSchema = z
  .object({
    name: courseNameSchema.optional(),
    code: courseCodeSchema.optional(),
    description: z.string().trim().max(4000).optional(),
    level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    masteryThreshold: bktBound.optional(),
    goalConceptId: z.string().trim().min(1).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const addCourseModuleSchema = z.object({
  moduleId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(140).optional(),
  masteryThreshold: bktBound.optional(),
  goalConceptId: z.string().trim().min(1).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const createSectionSchema = z.object({
  title: z.string().trim().min(1, "Section title is required").max(140),
  description: z.string().trim().max(2000).optional().default(""),
  orderIndex: z.number().int().min(0).optional().default(0),
});

export const updateSectionSchema = z
  .object({
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(2000).optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const attachConceptSchema = z.object({
  conceptId: z.string().trim().min(1, "Concept ID is required"),
  orderIndex: z.number().int().min(0).optional().default(0),
});

export const assignBatchesSchema = z.object({
  batchIds: z.array(z.string().trim().min(1)),
  deadline: z.string().datetime().optional().nullable(),
});
