import { describe, it, expect } from "vitest";
import { checkDatabaseConnection } from "@/db";

describe("Database Client & Health Check", () => {
  it("safely reports disconnected status when DATABASE_URL is missing or invalid without crashing", async () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      const status = await checkDatabaseConnection();
      expect(status.ok).toBe(false);
      expect(status.error).toBeDefined();
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      }
    }
  });
});
