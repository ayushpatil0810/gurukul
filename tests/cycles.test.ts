import { describe, expect, it } from "vitest";
import { checkPrerequisiteEdge, type PrerequisiteEdge } from "@/lib/engine/cycles";

const names = new Map([
  ["variables", "Variables"],
  ["functions", "Functions"],
  ["classes", "Classes and Objects"],
  ["inheritance", "Inheritance"],
  ["di", "Dependency Injection"],
]);

const chain: PrerequisiteEdge[] = [
  { conceptId: "functions", requiresId: "variables" },
  { conceptId: "classes", requiresId: "functions" },
  { conceptId: "inheritance", requiresId: "classes" },
  { conceptId: "di", requiresId: "inheritance" },
];

describe("prerequisite cycle detection", () => {
  it("accepts the TypeScript OOP chain", () => {
    expect(checkPrerequisiteEdge([], "functions", "variables", names).ok).toBe(true);
    expect(checkPrerequisiteEdge(chain.slice(0, 3), "di", "inheritance", names)).toEqual({
      ok: true,
    });
  });

  it("rejects a self-prerequisite", () => {
    const result = checkPrerequisiteEdge([], "variables", "variables", names);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("cannot be a prerequisite of itself");
      expect(result.message).toContain("Variables");
    }
  });

  it("rejects an edge that closes a cycle and names the path", () => {
    const result = checkPrerequisiteEdge(chain, "variables", "di", names);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.path).toEqual(["variables", "di", "inheritance", "classes", "functions", "variables"]);
      expect(result.message).toContain("would create a cycle");
      expect(result.message).toContain("Variables → Dependency Injection → Inheritance");
      expect(result.message).toContain("directed acyclic graph");
    }
  });

  it("rejects a two-node cycle", () => {
    const result = checkPrerequisiteEdge(
      [{ conceptId: "classes", requiresId: "functions" }],
      "functions",
      "classes",
      names,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.path).toEqual(["functions", "classes", "functions"]);
    }
  });

  it("allows an unrelated branch", () => {
    expect(
      checkPrerequisiteEdge(chain, "classes", "variables", names),
    ).toEqual({ ok: true });
  });
});
