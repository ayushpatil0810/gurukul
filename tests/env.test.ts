import { describe, it, expect } from "vitest";
import { serverEnvSchema, clientEnvSchema } from "@/lib/env";

describe("Environment Validation Schema", () => {
  it("validates valid server environment variables", () => {
    const validEnv = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@ep-cool-flower.neon.tech/neondb?sslmode=require",
      BETTER_AUTH_SECRET: "12345678901234567890123456789012",
      BETTER_AUTH_URL: "https://my-hackathon-app.vercel.app",
    };

    const parsed = serverEnvSchema.safeParse(validEnv);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NODE_ENV).toBe("production");
      expect(parsed.data.BETTER_AUTH_URL).toBe("https://my-hackathon-app.vercel.app");
    }
  });

  it("rejects SQLAlchemy-style database URLs", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql+psycopg://portal:portal@localhost:5432/portal",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects secrets shorter than 32 characters", () => {
    const invalidEnv = {
      NODE_ENV: "development",
      BETTER_AUTH_SECRET: "too-short",
    };

    const parsed = serverEnvSchema.safeParse(invalidEnv);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.format().BETTER_AUTH_SECRET).toBeDefined();
    }
  });

  it("validates client environment variables with optional URL", () => {
    const parsed = clientEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: "https://my-hackathon-app.vercel.app",
    });
    expect(parsed.success).toBe(true);

    const emptyParsed = clientEnvSchema.safeParse({});
    expect(emptyParsed.success).toBe(true);
  });
});
