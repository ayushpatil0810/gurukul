/**
 * Database Schema Registry
 *
 * Export all database tables and relations from this file.
 * Drizzle Kit and Better Auth use this registry as the single source of truth.
 *
 * To add new domain tables during the hackathon:
 * 1. Create a schema file (e.g., db/schema/items.ts)
 * 2. Export it from this file (export * from "./items")
 * 3. Run `npm run db:generate` or `bun run db:generate`
 */

export * from "./institutes";
export * from "./auth";
export * from "./portal";
export * from "./lessons";
export * from "./classroom";
export * from "./courses";
