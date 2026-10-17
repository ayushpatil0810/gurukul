import { z } from "zod";

/**
 * Reusable primitive validation building blocks.
 * Compose these to form feature request schemas.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email must not exceed 255 characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters long")
  .max(100, "Name must not exceed 100 characters");

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
