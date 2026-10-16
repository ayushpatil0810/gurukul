import { describe, expect, it } from "vitest";

import { applyAcknowledgement, EventBuffer, shouldContinueAfterAck } from "@/lib/engine/event-buffer";

describe("EventBuffer acknowledgements", () => {
  it("keeps events appended while an older batch is in flight", () => {
    const buffer = EventBuffer.create(1_000);
    buffer.record("insert", { text: "a" }, 1_100);
    const first = buffer.snapshot();
    buffer.record("insert", { text: "b" }, 1_200);
    const second = buffer.snapshot();
    buffer.record("insert", { text: "c" }, 1_350);

    buffer.acknowledge(second.map((event) => event.seq));
    expect(buffer.snapshot().map((event) => event.seq)).toEqual([3]);

    const restored = EventBuffer.create(1_000);
    restored.record("insert", { text: "a" }, 1_100);
    const older = restored.snapshot();
    restored.record("insert", { text: "b" }, 1_200);
    const newer = restored.snapshot();
    restored.record("insert", { text: "c" }, 1_350);
    restored.acknowledge(older.map((event) => event.seq));
    expect(restored.snapshot().map((event) => event.payload.text)).toEqual(["b", "c"]);
    restored.acknowledge(newer.map((event) => event.seq));
    expect(restored.snapshot().map((event) => event.seq)).toEqual([3]);
    expect(first[0]?.seq).toBe(1);
  });

  it("preserves unacknowledged events and their timestamps after a failed upload", () => {
    const buffer = EventBuffer.create(5_000);
    buffer.record("paste", { text: "ready" }, 5_040);
    buffer.record("delete", { removed: "y" }, 5_080);
    const failed = buffer.snapshot();
    buffer.acknowledge([]);
    const retry = buffer.snapshot();
    expect(retry).toEqual(failed);
    expect(retry.map((event) => event.t)).toEqual([40, 80]);

    buffer.record("focus", {}, 5_100);
    buffer.acknowledge(failed.map((event) => event.seq));
    const pending = buffer.snapshot();
    expect(pending).toEqual([
      expect.objectContaining({ seq: 3, t: 100, type: "focus" }),
    ]);
  });

  it("removes only the sequences named by a partial acknowledgement", () => {
    const buffer = EventBuffer.create(0);
    buffer.record("insert", { text: "a" }, 10);
    buffer.record("insert", { text: "b" }, 20);
    buffer.record("insert", { text: "c" }, 30);
    const before = buffer.snapshot();
    expect(applyAcknowledgement(buffer, [2])).toBe(true);
    expect(buffer.snapshot().map((event) => event.seq)).toEqual([1, 3]);
    expect(buffer.snapshot().map((event) => event.t)).toEqual([10, 30]);
    expect(applyAcknowledgement(buffer, [])).toBe(true);
    expect(applyAcknowledgement(buffer, "1,3")).toBe(false);
    expect(applyAcknowledgement(buffer, [1, 1.5])).toBe(false);
    expect(applyAcknowledgement(buffer, { acked: [1] })).toBe(false);
    expect(buffer.snapshot()).toEqual(before.filter((event) => event.seq !== 2));
  });

  it("retries a partial acknowledgement and stays quiet when nothing was confirmed", () => {
    expect(shouldContinueAfterAck([1, 2, 3], [2, 3], [1])).toBe(true);
    expect(shouldContinueAfterAck([1, 2], [3], [1, 2])).toBe(true);
    expect(shouldContinueAfterAck([1, 2], [1, 2], [])).toBe(false);
    expect(shouldContinueAfterAck([1, 2], [], [1, 2])).toBe(false);
  });

  it("assigns monotonic sequence numbers and restores the recording clock", () => {
    const buffer = EventBuffer.create(10_000);
    expect(buffer.record("focus", {}, 10_000).seq).toBe(1);
    buffer.acknowledge([1]);
    expect(buffer.record("blur", {}, 10_025).seq).toBe(2);
    const saved = buffer.serialize();
    const restored = EventBuffer.restore(saved, 99_000);
    const next = restored.record("insert", { text: "z" }, 10_050);
    expect(next).toMatchObject({ seq: 3, t: 50, payload: { schemaVersion: 2, text: "z" } });
    expect(restored.snapshot().find((event) => event.seq === 2)?.t).toBe(25);
  });
});
