import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";
import { env } from "@/lib/env";

/**
 * Server-side Better Auth Instance
 *
 * Configured with Neon PostgreSQL via Drizzle ORM adapter.
 * Uses email/password authentication and Next.js cookie integration.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [
    nextCookies(),
  ],
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
