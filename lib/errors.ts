import { NextResponse } from "next/server";

/**
 * Standard Application Error Codes
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "DATABASE_ERROR"
  | "INTERNAL_SERVER_ERROR";

/**
 * Reusable, typed application error.
 * Preserves error semantics without exposing internal implementation details.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(options: {
    message: string;
    code?: ErrorCode;
    statusCode?: number;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code ?? "INTERNAL_SERVER_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message = "Bad request", details?: unknown): AppError {
    return new AppError({
      message,
      code: "BAD_REQUEST",
      statusCode: 400,
      details,
    });
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError({
      message,
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError({
      message,
      code: "FORBIDDEN",
      statusCode: 403,
    });
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError({
      message,
      code: "NOT_FOUND",
      statusCode: 404,
    });
  }

  static conflict(message = "Resource conflict", details?: unknown): AppError {
    return new AppError({
      message,
      code: "CONFLICT",
      statusCode: 409,
      details,
    });
  }

  static validation(message = "Validation failed", details?: unknown): AppError {
    return new AppError({
      message,
      code: "VALIDATION_ERROR",
      statusCode: 422,
      details,
    });
  }

  static tooManyRequests(message = "Too many runs. Wait a moment and try again."): AppError {
    return new AppError({
      message,
      code: "RATE_LIMITED",
      statusCode: 429,
    });
  }

  static internal(message = "An unexpected error occurred"): AppError {
    return new AppError({
      message,
      code: "INTERNAL_SERVER_ERROR",
      statusCode: 500,
    });
  }
}

/**
 * Lightweight, functional Result type for operations that can fail.
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Sanitizes any error to prevent leaking secrets, database connection strings,
 * or stack traces to end users.
 */
export function formatError(error: unknown): {
  message: string;
  code: ErrorCode;
  details?: unknown;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    // Hide internal system / database error messages in production
    const isProduction = process.env.NODE_ENV === "production";
    return {
      message: isProduction ? "An internal error occurred" : error.message,
      code: "INTERNAL_SERVER_ERROR",
    };
  }

  return {
    message: "An unexpected error occurred",
    code: "INTERNAL_SERVER_ERROR",
  };
}

/**
 * Creates a standardized JSON error response for Route Handlers.
 */
export function apiErrorResponse(
  error: unknown,
  fallbackStatus = 500
): NextResponse {
  const formatted = formatError(error);
  const status =
    error instanceof AppError ? error.statusCode : fallbackStatus;

  return NextResponse.json(
    {
      success: false,
      error: formatted,
    },
    { status }
  );
}
