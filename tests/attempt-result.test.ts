import { describe, expect, it } from "vitest";

import { toHiddenResults } from "@/lib/engine/attempt-result";

describe("toHiddenResults", () => {
  it("returns counts and categories without program output", () => {
    const result = toHiddenResults([
      { id: "a", outcome: "ok", message: "The program finished." },
      { id: "b", outcome: "wrong_answer", message: "The program output did not match this test." },
    ]);
    expect(result).toEqual({
      passed: 1,
      total: 2,
      passRate: 0.5,
      tests: [
        { id: "a", passed: true, category: "ok", message: "The program finished." },
        {
          id: "b",
          passed: false,
          category: "wrong_answer",
          message: "The program output did not match this test.",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("stdout");
    expect(JSON.stringify(result)).not.toContain("HIDDEN");
  });
});
