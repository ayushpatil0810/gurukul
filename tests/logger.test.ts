import { describe, it, expect } from "vitest";
import { redactSensitiveData } from "@/lib/logger";

describe("Logger & Sensitive Data Redaction", () => {
  it("redacts sensitive fields in top-level and nested objects", () => {
    const input = {
      username: "alice",
      password: "SuperSecretPassword!",
      token: "jwt.token.here",
      metadata: {
        apiKey: "sk-12345",
        environment: "production",
        nested: {
          secret: "very-secret",
          publicInfo: "visible",
        },
      },
    };

    const redacted = redactSensitiveData(input) as {
      username: string;
      password: string;
      token: string;
      metadata: {
        apiKey: string;
        environment: string;
        nested: {
          secret: string;
          publicInfo: string;
        };
      };
    };

    expect(redacted.username).toBe("alice");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.metadata.apiKey).toBe("[REDACTED]");
    expect(redacted.metadata.environment).toBe("production");
    expect(redacted.metadata.nested.secret).toBe("[REDACTED]");
    expect(redacted.metadata.nested.publicInfo).toBe("visible");
  });

  it("leaves primitive values unchanged", () => {
    expect(redactSensitiveData("hello")).toBe("hello");
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData(null)).toBe(null);
  });
});
