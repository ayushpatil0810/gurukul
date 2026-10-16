import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

/** Socket and HTTP callers must not receive request bodies or database text. */
export function ingestErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return "Could not store events";
  if (error instanceof AppError) return error.message;
  return "Could not store events";
}
