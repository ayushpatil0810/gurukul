import { describe, expect, it } from "vitest";
import {
  assembleHeatmap,
  explanationLabel,
  masteryBand,
  masteryKey,
  summarizeCohort,
} from "@/lib/engine/dashboard-bands";

describe("dashboard mastery bands", () => {
  it("does not treat a missing record as zero", () => {
    expect(masteryBand(null, 0.8)).toBe("not_recorded");
    expect(masteryBand(0, 0.8)).toBe("below_threshold");
    expect(masteryBand(0.8, 0.8)).toBe("solid");
    expect(masteryBand(0.79, 0.8)).toBe("below_threshold");
  });

  it("builds every heatmap cell from one mastery map", () => {
    const students = Array.from({ length: 40 }, (_, index) => `student-${index}`);
    const concepts = Array.from({ length: 8 }, (_, index) => `concept-${index}`);
    const mastery = new Map<string, number>();
    mastery.set(masteryKey("student-0", "concept-0"), 0);
    mastery.set(masteryKey("student-1", "concept-1"), 0.91);
    const cells = assembleHeatmap({ studentIds: students, conceptIds: concepts, mastery, threshold: 0.8 });
    expect(cells).toHaveLength(320);
    expect(cells.find((cell) => cell.studentId === "student-0" && cell.conceptId === "concept-0")).toMatchObject({
      pKnow: 0,
      band: "below_threshold",
    });
    expect(cells.find((cell) => cell.studentId === "student-2" && cell.conceptId === "concept-2")).toMatchObject({
      pKnow: null,
      band: "not_recorded",
      label: "Not recorded",
    });
  });

  it("averages only stored mastery and keeps explanation text apart from a pass rate", () => {
    const summary = summarizeCohort({
      students: [{ id: "ada" }, { id: "ben" }],
      concepts: [
        { id: "variables", name: "Variables" },
        { id: "functions", name: "Functions" },
      ],
      edges: [{ conceptId: "functions", requiresId: "variables" }],
      mastery: new Map([
        [masteryKey("ada", "variables"), 0.5],
        [masteryKey("ben", "functions"), 0.2],
      ]),
      threshold: 0.8,
    });
    const functions = summary.find((item) => item.conceptId === "functions");
    expect(functions).toMatchObject({
      recorded: 1,
      students: 2,
      below: 1,
      mean: 0.2,
      belowThreshold: true,
      blocking: 0,
    });
    const variables = summary.find((item) => item.conceptId === "variables");
    expect(variables?.mean).toBe(0.5);
    expect(variables?.blocking).toBe(1);
    expect(explanationLabel(null)).toBe("No explanation");
    expect(explanationLabel({ status: "answered", yes: 0, partial: 0, no: 1, needsReview: 1 })).toBe(
      "1 incorrect, 1 need review",
    );
  });
});
