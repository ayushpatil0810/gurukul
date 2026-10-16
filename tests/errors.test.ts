import { describe, it, expect } from "vitest";
import { AppError, ok, err, formatError } from "@/lib/errors";

describe("Application Error Utilities", () => {
  it("creates AppError with correct status code and code enum", () => {
    const error = AppError.notFound("User not found");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("User not found");
    expect(error.isOperational).toBe(true);
  });

  it("creates AppError.validation with details", () => {
    const details = { email: ["Invalid email format"] };
    const error = AppError.validation("Validation failed", details);
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(details);
  });

  it("handles Result ok and err builders", () => {
    const successResult = ok({ id: "123" });
    expect(successResult.success).toBe(true);
    if (successResult.success) {
      expect(successResult.data.id).toBe("123");
    }

    const failureResult = err(AppError.unauthorized("Access denied"));
    expect(failureResult.success).toBe(false);
    if (!failureResult.success) {
      expect(failureResult.error.statusCode).toBe(401);
    }
  });

  it("formats generic errors safely without leaking internal details", () => {
    const rawError = new Error("database connection timeout at secret_host:5432");
    const formatted = formatError(rawError);
    expect(formatted.code).toBe("INTERNAL_SERVER_ERROR");
    expect(formatted.message).toBeDefined();
  });
});
