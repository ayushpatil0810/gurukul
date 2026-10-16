import { describe, expect, it } from "vitest";

import { hashEvent, planEventAppend, type TimelineEvent } from "@/lib/engine/event-chain";

describe("planEventAppend", () => {
  it("chains hashes and fills a gap with a data-quality note", () => {
    const first = planEventAppend([], [{ seq: 1, t: 0, type: "session_start", payload: {} }]);
    expect(first[0]?.prevHash).toBeNull();

    const second = planEventAppend(first, [{ seq: 2, t: 10, type: "insert", payload: { length: 1 } }]);
    expect(second[0]?.prevHash).toBe(hashEvent(first[0] as TimelineEvent));

    const stored = [...first, ...second];
    const jumped = planEventAppend(stored, [{ seq: 4, t: 30, type: "paste", payload: { length: 20 } }]);
    expect(jumped.map((event) => event.seq)).toEqual([3, 4]);
    expect(jumped[0]?.type).toBe("data_quality");
    expect(jumped[1]?.prevHash).toBe(hashEvent(jumped[0] as TimelineEvent));

    const again = planEventAppend([...stored, ...jumped], [{ seq: 2, t: 10, type: "insert", payload: {} }]);
    expect(again).toEqual([]);
  });
});
