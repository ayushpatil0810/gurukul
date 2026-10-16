import { describe, expect, it } from "vitest";
import { layoutConceptMap } from "@/lib/engine/concept-layout";

describe("concept map layout", () => {
  it("places a prerequisite to the left of the concept that needs it", () => {
    const positions = layoutConceptMap(
      [
        { id: "variables", name: "Variables" },
        { id: "functions", name: "Functions" },
      ],
      [{ conceptId: "functions", requiresId: "variables" }],
    );
    const variables = positions.find((item) => item.id === "variables");
    const functions = positions.find((item) => item.id === "functions");
    expect(variables && functions && variables.x < functions.x).toBe(true);
  });
});
