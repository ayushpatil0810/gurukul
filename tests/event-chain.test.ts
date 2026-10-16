import { describe, expect, it } from "vitest";

import { hashEvent, planEventAppend, seqsToAcknowledge, SERVER_SEQ_BASE, verifyEventChain } from "@/lib/engine/event-chain";
import { gradedRecordingAllowed, sanitizeClientPayload } from "@/lib/engine/event-payload";

describe("planEventAppend", () => {
  it("chains hashes for contiguous events and ignores duplicates", () => {
    const first = planEventAppend([], [{ seq: 1, t: 0, type: "session_start", payload: {} }]);
    expect(first[0]?.prevHash).toBeNull();

    const second = planEventAppend(first, [{ seq: 2, t: 10, type: "insert", payload: { length: 1 } }]);
    expect(second).toHaveLength(1);
    expect(second[0]?.prevHash).toBe(hashEvent(first[0]!));
    expect(verifyEventChain([...first, ...second])).toBe(true);

    const again = planEventAppend([...first, ...second], [{ seq: 2, t: 999, type: "delete", payload: { hacked: true } }]);
    expect(again).toEqual([]);
    expect(second[0]?.t).toBe(10);
  });

  it("records a sequence gap without taking the missing client sequence", () => {
    const stored = planEventAppend([], [
      { seq: 1, t: 0, type: "session_start", payload: {} },
      { seq: 2, t: 8, type: "insert", payload: { length: 1 } },
    ]);
    const jumped = planEventAppend(stored, [{ seq: 5, t: 30, type: "paste", payload: { length: 20 } }]);
    const note = jumped.find((event) => event.type === "data_quality");
    const paste = jumped.find((event) => event.type === "paste");
    expect(note?.seq).toBeGreaterThanOrEqual(SERVER_SEQ_BASE);
    expect(note?.payload).toMatchObject({
      missingFrom: 3,
      missingTo: 4,
      reason: "sequence_gap",
      interpretation: "missing_telemetry",
      misconduct: false,
    });
    expect(paste).toMatchObject({ seq: 5, t: 30 });
    expect(paste?.prevHash).toBe(hashEvent(note!));
    expect(verifyEventChain([...stored, ...jumped])).toBe(true);
  });

  it("stores an out-of-order event when it arrives later and resolves the gap", () => {
    const opened = planEventAppend([], [
      { seq: 1, t: 0, type: "session_start", payload: {} },
      { seq: 3, t: 20, type: "insert", payload: { text: "a" } },
    ]);
    expect(opened.some((event) => event.seq === 3)).toBe(true);
    const late = planEventAppend(opened, [{ seq: 2, t: 10, type: "insert", payload: { text: "b" } }]);
    const filled = late.find((event) => event.seq === 2);
    expect(filled).toMatchObject({ t: 10, type: "insert", payload: { text: "b" } });
    expect(late.some((event) => event.type === "data_quality" && (event.payload as { resolved?: boolean }).resolved === true)).toBe(
      true,
    );
    const duplicate = planEventAppend([...opened, ...late], [{ seq: 2, t: 77, type: "delete", payload: {} }]);
    expect(duplicate).toEqual([]);
    expect(verifyEventChain([...opened, ...late])).toBe(true);
  });

  it("resolves a gap once and keeps the original note", () => {
    const opened = planEventAppend([], [
      { seq: 1, t: 0, type: "session_start", payload: {} },
      { seq: 3, t: 20, type: "insert", payload: { text: "a" } },
    ]);
    const original = opened.find((event) => event.type === "data_quality");
    const late = planEventAppend(opened, [{ seq: 2, t: 10, type: "insert", payload: { text: "b" } }]);
    const stored = [...opened, ...late];
    const resolutions = stored.filter(
      (event) => event.type === "data_quality" && (event.payload as { resolved?: boolean }).resolved === true,
    );
    expect(resolutions).toHaveLength(1);
    expect(stored.filter((event) => event.seq === original?.seq)).toEqual([original]);
    const again = planEventAppend(stored, [{ seq: 4, t: 40, type: "focus", payload: {} }]);
    expect(again.some((event) => (event.payload as { resolved?: boolean }).resolved === true)).toBe(false);
    expect(verifyEventChain([...stored, ...again])).toBe(true);
  });

  it("keeps a historical gap note on its old sequence and extends the chain", () => {
    const first = {
      seq: 1,
      t: 0,
      type: "session_start",
      payload: {},
      prevHash: null,
      chainIndex: 1,
      schemaVersion: 1,
    };
    const second = {
      seq: 2,
      t: 5,
      type: "insert",
      payload: { length: 1 },
      prevHash: hashEvent(first),
      chainIndex: 2,
      schemaVersion: 1,
    };
    const placeholder = {
      seq: 3,
      t: 6,
      type: "data_quality",
      payload: { missing: 3 },
      prevHash: hashEvent(second),
      chainIndex: 3,
      schemaVersion: 1,
    };
    expect(verifyEventChain([placeholder, first, second])).toBe(true);

    const extended = planEventAppend([first, second, placeholder], [
      { seq: 4, t: 9, type: "paste", payload: { length: 2 } },
    ]);
    expect(extended.some((event) => event.type === "data_quality")).toBe(false);
    expect(extended[0]?.prevHash).toBe(hashEvent(placeholder));
    expect(verifyEventChain([first, second, placeholder, ...extended])).toBe(true);

    const blocked = planEventAppend([first, second, placeholder, ...extended], [
      { seq: 3, t: 99, type: "insert", payload: { text: "invented" } },
    ]);
    expect(blocked).toEqual([]);
    expect(seqsToAcknowledge([first, second, placeholder, ...extended], [3, 4])).toEqual([3, 4]);
    expect(placeholder.payload).toEqual({ missing: 3 });
  });

  it("does not store a client sequence in the server range", () => {
    expect(
      planEventAppend([], [{ seq: SERVER_SEQ_BASE, t: 0, type: "insert", payload: { text: "nope" } }]),
    ).toEqual([]);
  });

  it("does not resolve a gap from a sequence outside that gap", () => {
    const opened = planEventAppend([], [
      { seq: 1, t: 0, type: "session_start", payload: {} },
      { seq: 4, t: 40, type: "insert", payload: { text: "d" } },
    ]);
    const note = opened.find((event) => event.type === "data_quality");
    expect(note?.payload).toMatchObject({ missingFrom: 2, missingTo: 3 });
    const partial = planEventAppend(opened, [{ seq: 2, t: 20, type: "insert", payload: { text: "b" } }]);
    expect(partial.some((event) => (event.payload as { resolved?: boolean }).resolved === true)).toBe(false);
    expect(partial.some((event) => event.seq === note?.seq)).toBe(false);
    const filled = planEventAppend([...opened, ...partial], [{ seq: 3, t: 30, type: "insert", payload: { text: "c" } }]);
    expect(filled.filter((event) => (event.payload as { resolved?: boolean }).resolved === true)).toHaveLength(1);
  });

  it("accepts events that arrive together out of order without a false gap", () => {
    const planned = planEventAppend([], [
      { seq: 3, t: 3, type: "insert", payload: { text: "c" } },
      { seq: 1, t: 1, type: "session_start", payload: {} },
      { seq: 2, t: 2, type: "insert", payload: { text: "b" } },
    ]);
    expect(planned.some((event) => event.type === "data_quality")).toBe(false);
    expect(planned.map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(verifyEventChain(planned)).toBe(true);
  });
});

describe("event payload trust boundaries", () => {
  it("drops client-supplied server fields", () => {
    expect(
      sanitizeClientPayload({
        text: "x",
        receivedAt: "1999-01-01T00:00:00.000Z",
        prevHash: "deadbeef",
        misconduct: true,
      }),
    ).toEqual({ text: "x" });
  });

  it("requires consent before a graded recording", () => {
    expect(gradedRecordingAllowed({ mode: "practice", consentId: null })).toBe(true);
    expect(gradedRecordingAllowed({ mode: "graded", consentId: "consent-1" })).toBe(true);
    expect(gradedRecordingAllowed({ mode: "graded", consentId: null })).toBe(false);
  });
});
