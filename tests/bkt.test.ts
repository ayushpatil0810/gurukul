import { describe, expect, it } from "vitest";

import { attemptIsCorrect, bktPosterior, bktUpdate, DEFAULT_BKT_PARAMS } from "@/lib/engine/bkt";

const params = DEFAULT_BKT_PARAMS;

describe("bktUpdate", () => {
  it("matches the hand-computed correct update from p = 0.20", () => {
    expect(bktPosterior(0.2, true, params)).toBeCloseTo(0.18 / 0.34, 12);
    expect(bktUpdate(0.2, true, params)).toBeCloseTo(0.6, 12);
  });

  it("matches the hand-computed wrong update from p = 0.20", () => {
    const posterior = 0.02 / 0.66;
    expect(bktPosterior(0.2, false, params)).toBeCloseTo(posterior, 12);
    expect(bktUpdate(0.2, false, params)).toBeCloseTo(posterior + (1 - posterior) * 0.15, 12);
  });

  it("counts an attempt as correct only when every hidden test passes", () => {
    expect(attemptIsCorrect(1)).toBe(true);
    expect(attemptIsCorrect(0.5)).toBe(false);
    expect(attemptIsCorrect(0.8, 0.8)).toBe(true);
  });
});
