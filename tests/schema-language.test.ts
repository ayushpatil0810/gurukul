import { describe, expect, it } from "vitest";
import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

const forbiddenColumnPattern = /cheat|fraud|guilty/;

describe("portal schema language", () => {
  it("does not define a verdict column or an aggregate score column", () => {
    const names: string[] = [];
    for (const value of Object.values(schema)) {
      if (is(value, PgTable)) {
        for (const column of Object.values(getTableColumns(value))) {
          names.push(column.name);
        }
      }
    }

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.toLowerCase()).not.toMatch(forbiddenColumnPattern);
    }
    expect(names).toContain("t_start");
    expect(names).toContain("t_end");
  });
});
