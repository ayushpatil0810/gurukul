import { describe, expect, it } from "vitest";
import { toPublicQuestion } from "@/lib/engine/public-question";

const hiddenInput = "HIDDEN_INPUT_SENTINEL_91f3";
const hiddenExpected = "HIDDEN_EXPECTED_SENTINEL_91f3";

describe("public question payload", () => {
  it("keeps visible tests and strips hidden inputs and expected outputs", () => {
    const payload = toPublicQuestion(
      {
        id: "q1",
        statement: "Add two numbers",
        difficulty: 2,
        languages: ["javascript"],
        starterCode: { javascript: "function add() {}" },
        status: "published",
      },
      [
        {
          id: "visible-1",
          visibility: "visible",
          input: "2 3\n",
          expectedOutput: "5\n",
        },
        {
          id: "hidden-1",
          visibility: "hidden",
          input: hiddenInput,
          expectedOutput: hiddenExpected,
        },
      ],
      ["functions"],
    );

    expect(payload.tests).toEqual([
      {
        id: "visible-1",
        visibility: "visible",
        input: "2 3\n",
        expectedOutput: "5\n",
      },
      { id: "hidden-1", visibility: "hidden" },
    ]);
    expect(payload.hiddenTestCount).toBe(1);
    expect(payload.visibleTestCount).toBe(1);

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(hiddenInput);
    expect(serialized).not.toContain(hiddenExpected);
    expect(serialized).not.toContain("referenceSolution");
  });
});
