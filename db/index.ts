import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Reusable Drizzle database client configured for Neon PostgreSQL.
 *
 * Uses @neondatabase/serverless HTTP query driver for zero-cold-start,
 * connection-pooling-free queries in serverless Next.js App Router environments.
 */

function createDbClient(): NeonHttpDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // Return a safe placeholder client during build/test phase when DATABASE_URL is not set
    const fallbackExecutor: NeonQueryFunction<boolean, boolean> = (() => {
      throw new Error(
        "DATABASE_URL is not configured. Please set a valid Neon connection string in your .env file."
      );
    }) as unknown as NeonQueryFunction<boolean, boolean>;

    return drizzle(fallbackExecutor, { schema });
  }

  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

// Global caching in development to prevent duplicate instances across Next.js hot reloads
const globalForDb = globalThis as unknown as {
  drizzleDb?: NeonHttpDatabase<typeof schema>;
};

export const db = globalForDb.drizzleDb ?? createDbClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.drizzleDb = db;
}

/**
 * Utility to verify Neon database connectivity without crashing the app.
 * Useful for healthcheck endpoints and diagnostic scripts.
 */
export async function checkDatabaseConnection(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { ok: false, error: "DATABASE_URL environment variable is missing" };
  }

  const start = Date.now();
  try {
    const sql = neon(connectionString);
    await sql`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown database connection error",
    };
  }
}

export type Database = typeof db;
export { schema };
