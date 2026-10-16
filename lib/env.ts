import { z } from "zod";

/**
 * Environment Variable Schema & Runtime Validator
 *
 * Enforces strict typing and presence of required variables.
 * Prevents server-only secrets from being leaked or misused.
 */

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== "" ? val : undefined))
    .refine(
      (val) => !val || !val.includes("+"),
      "DATABASE_URL must be a node-postgres URL such as postgresql://user:pass@host:5432/db"
    ),
  REDIS_URL: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== "" ? val : undefined)),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters long")
    .default("01234567890123456789012345678901"), // Safe fallback in dev/test
  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL must be a valid URL")
    .default("http://localhost:3000"),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "❌ Invalid environment variables detected:\n",
      JSON.stringify(result.error.format(), null, 2),
      "\n💡 Please check your .env file or copy from .env.example."
    );
    throw new Error("Invalid server environment configuration");
  }

  return result.data;
}

export const env = parseServerEnv();
