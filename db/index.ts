import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Drizzle client for Docker Compose PostgreSQL via node-postgres.
 * Importing this module does not open a connection. Queries do.
 */

const globalForDb = globalThis as unknown as {
  drizzleDb?: NodePgDatabase<typeof schema>;
  drizzlePool?: Pool;
};

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
  });
}

function createDb(): { db: NodePgDatabase<typeof schema>; pool: Pool } {
  const connectionString = process.env.DATABASE_URL;
  const pool = connectionString
    ? createPool(connectionString)
    : createPool("postgresql://portal:portal@127.0.0.1:1/portal");
  return { db: drizzle(pool, { schema }), pool };
}

const created = globalForDb.drizzleDb
  ? { db: globalForDb.drizzleDb, pool: globalForDb.drizzlePool! }
  : createDb();

export const db = created.db;
export const pool = created.pool;

if (process.env.NODE_ENV !== "production") {
  globalForDb.drizzleDb = db;
  globalForDb.drizzlePool = pool;
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

/**
 * Verifies PostgreSQL connectivity without crashing the app on import.
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
  const probe = createPool(connectionString);
  try {
    await probe.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database connection error";
    const redacted = connectionString
      ? message.replaceAll(connectionString, "[redacted]")
      : message;
    return { ok: false, error: redacted };
  } finally {
    await probe.end();
  }
}

export type Database = typeof db;
export { schema };
