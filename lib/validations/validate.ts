import { z } from "zod";
import { type Result, ok, err, AppError } from "@/lib/errors";

/**
 * Formats Zod errors into a clean dictionary of field name -> error messages.
 */
export function formatZodErrors(
  error: z.ZodError
): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Validates untrusted input against a Zod schema.
 * Returns a typed Result with formatted field errors if validation fails.
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  data: unknown
): Result<T, Record<string, string[]>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    return err(formatZodErrors(result.error));
  }

  return ok(result.data);
}

/**
 * Parses input against a Zod schema or throws a standardized AppError.validation.
 * Ideal for Server Actions and API Route handlers.
 */
export function assertValidInput<T>(
  schema: z.ZodType<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw AppError.validation(
      "Validation failed for request input",
      formatZodErrors(result.error)
    );
  }

  return result.data;
}
