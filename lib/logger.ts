/**
 * Structured Logging Utility
 *
 * Provides leveled, structured logging with automatic redaction of sensitive fields.
 * Safe for serverless runtimes, Next.js route handlers, and client environments.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "accesstoken",
  "refreshtoken",
  "clientsecret",
  "database_url",
  "creditcard",
  "apikey",
]);

/**
 * Deeply clones an object, replacing sensitive keys with '[REDACTED]'.
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

class Logger {
  private getMinLevel(): LogLevel {
    if (process.env.NODE_ENV === "test") {
      return "warn";
    }
    if (process.env.NODE_ENV === "production") {
      return "info";
    }
    return "debug";
  }

  private shouldLog(level: LogLevel): boolean {
    const minLevel = this.getMinLevel();
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): string {
    const timestamp = new Date().toISOString();
    const sanitizedMetadata = metadata ? redactSensitiveData(metadata) : undefined;

    if (process.env.NODE_ENV === "production") {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...(sanitizedMetadata ? { metadata: sanitizedMetadata } : {}),
      });
    }

    const metaStr = sanitizedMetadata ? ` ${JSON.stringify(sanitizedMetadata)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, metadata));
    }
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, metadata));
    }
  }

  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      const errorMeta: Record<string, unknown> = {
        ...metadata,
      };

      if (error instanceof Error) {
        errorMeta.error = {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
        };
      } else if (error !== undefined) {
        errorMeta.rawError = String(error);
      }

      console.error(this.formatMessage("error", message, errorMeta));
    }
  }
}

const logger = new Logger();
