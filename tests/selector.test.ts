import { describe, expect, it } from "vitest";

import { predictedSuccess, selectNextQuestion } from "@/lib/engine/selector";

const concepts = [
  { id: "variables", name: "Variables" },
  { id: "functions", name: "Functions" },
  { id: "classes", name: "Classes and Objects" },
  { id: "inheritance", name: "Inheritance" },
  { id: "di", name: "Dependency Injection" },
];

const edges = [
  { conceptId: "functions", requiresId: "variables" },
  { conceptId: "classes", requiresId: "functions" },
  { conceptId: "inheritance", requiresId: "classes" },
  { conceptId: "di", requiresId: "inheritance" },
];

const questions = [
  { id: "v1", conceptId: "variables", difficulty: 1 },
  { id: "v2", conceptId: "variables", difficulty: 2 },
  { id: "f1", conceptId: "functions", difficulty: 1 },
  { id: "f2", conceptId: "functions", difficulty: 3 },
  { id: "c1", conceptId: "classes", difficulty: 2 },
  { id: "c2", conceptId: "classes", difficulty: 4 },
  { id: "d1", conceptId: "di", difficulty: 3 },
];

function choose(mastery: Record<string, number>, attempted: string[] = []) {
  return selectNextQuestion({
    goalId: "di",
    concepts,
    edges,
    mastery,
    threshold: 0.8,
    questions,
    attemptedQuestionIds: attempted,
  });
}

describe("selectNextQuestion", () => {
  it("starts a cold student on the first concept", () => {
    const decision = choose({});
    expect(decision.conceptId).toBe("variables");
    expect(decision.reason).toContain("Variables");
    expect(decision.questionId).toBe("v1");
  });

  it("routes two mastery states to different concepts", () => {
    const ada = choose({ variables: 0.9, functions: 0.3 });
    const ben = choose({ variables: 0.95, functions: 0.9, classes: 0.35 });
    expect(ada.conceptId).toBe("functions");
    expect(ada.reason).toContain("Functions");
    expect(ada.reason).toContain("0.30");
    expect(ben.conceptId).toBe("classes");
    expect(ben.reason).toContain("Classes and Objects");
    expect(ada.conceptId).not.toBe(ben.conceptId);
    expect(ada.alternatives.some((item) => item.conceptId === "variables")).toBe(true);
  });

  it("selects the goal once every ancestor is at the threshold", () => {
    const decision = choose({
      variables: 0.9,
      functions: 0.9,
      classes: 0.85,
      inheritance: 0.88,
      di: 0.91,
    });
    expect(decision.conceptId).toBe("di");
    expect(decision.questionId).toBe("d1");
    expect(decision.reason).toContain("goal");
  });

  it("is deterministic and skips attempted questions", () => {
    const first = choose({ variables: 0.9, functions: 0.8 });
    const second = choose({ variables: 0.9, functions: 0.8 });
    expect(second).toEqual(first);
    const next = choose({ variables: 0.9, functions: 0.8 }, [first.questionId ?? ""]);
    expect(next.conceptId).toBe(first.conceptId);
    expect(next.questionId).not.toBe(first.questionId);
  });

  it("picks the difficulty whose predicted success is nearest 70%", () => {
    expect(predictedSuccess(0.8, 2)).toBeCloseTo(0.684, 6);
    expect(Math.abs(predictedSuccess(0.8, 2) - 0.7)).toBeLessThan(Math.abs(predictedSuccess(0.8, 1) - 0.7));
    const decision = choose({
      variables: 0.95,
      functions: 0.9,
      classes: 0.79,
    });
    expect(decision.conceptId).toBe("classes");
    expect(decision.questionId).toBe("c1");
  });
});
