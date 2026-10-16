import { z } from "zod";

export const createLessonSchema = z.object({
  moduleId: z.string().trim().min(1),
  conceptId: z.string().trim().min(1),
  topic: z.string().trim().min(1).max(200),
  objectives: z.string().trim().min(1).max(2000),
  learnerLevel: z.string().trim().min(1).max(40),
  durationMinutes: z.number().int().min(5).max(90),
  sourceMaterial: z.string().max(8000).optional(),
  codeLanguage: z.enum(["typescript", "javascript", "java", "cpp"]).optional(),
});

export const outlineSceneSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(["slide", "quiz", "interactive"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  keyPoints: z.array(z.string().trim().min(1).max(240)).max(12),
  order: z.number().int().min(1).max(20),
  quizConfig: z
    .object({
      questionCount: z.number().int().min(1).max(6),
      difficulty: z.enum(["easy", "medium", "hard"]),
      questionTypes: z.array(z.enum(["single", "multiple", "text"])).min(1).max(3),
    })
    .optional(),
});

export const saveOutlineSchema = z.object({
  version: z.number().int().positive(),
  outlines: z.array(outlineSceneSchema).min(1).max(20),
  codeLanguage: z.enum(["typescript", "javascript", "java", "cpp"]).optional(),
});

export const saveScenesSchema = z.object({
  version: z.number().int().positive(),
  scenes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(160),
        body: z.string().max(8000),
        questions: z
          .array(
            z.object({
              id: z.string().trim().min(1).max(80),
              prompt: z.string().trim().min(1).max(500),
              options: z.array(z.string().trim().min(1).max(240)).max(6),
            }),
          )
          .max(12),
      }),
    )
    .max(20),
});

export const generateContentSchema = z.object({
  version: z.number().int().positive(),
  outlineId: z.string().trim().min(1).max(80).optional(),
});

export const versionSchema = z.object({
  version: z.number().int().positive(),
});
