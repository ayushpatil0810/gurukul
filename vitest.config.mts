import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_ENV_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
] as const;

function envFromFile(filePath: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (existsSync(filePath)) {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value !== "") parsed[key] = value;
    }
  }

  const values: Record<string, string> = {};
  for (const key of TEST_ENV_KEYS) {
    const value = process.env[key] || parsed[key];
    if (value) values[key] = value;
  }
  return values;
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000,
    env: envFromFile(path.resolve(import.meta.dirname, ".env")),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
