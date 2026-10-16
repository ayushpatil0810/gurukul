import { describe, expect, it } from "vitest";

import { EventBuffer } from "@/lib/engine/event-buffer";
import { reconstructDocument } from "@/lib/engine/editor-events";
import { openRecording } from "@/lib/engine/session-clock";

describe("session recording clock", () => {
  it("baselines edits that were buffered before session_start", () => {
    const opened = openRecording({
      buffered: [
        {
          type: "insert",
          payload: {
            schemaVersion: 2,
            range: { start: 2, end: 2 },
            text: "!",
            removed: "",
            length: 1,
            removedLength: 0,
          },
          at: 1_000,
        },
      ],
      now: 1_500,
      mode: "practice",
      baseline: "hi",
    });
    expect(opened.originMs).toBe(1_000);
    const buffer = EventBuffer.create(opened.originMs);
    for (const entry of opened.entries) buffer.recordAt(entry.type, entry.payload, entry.at);
    const events = buffer.snapshot();
    expect(events.map((event) => [event.seq, event.type, event.t])).toEqual([
      [1, "insert", 0],
      [2, "session_start", 500],
    ]);
    expect(reconstructDocument("starter", events)).toEqual({ ok: true, text: "hi!" });
  });

  it("starts the clock at session creation when nothing was buffered", () => {
    const opened = openRecording({ buffered: [], now: 2_000, mode: "graded", baseline: "code" });
    expect(opened.originMs).toBe(2_000);
    expect(opened.entries.map((entry) => entry.type)).toEqual(["session_start"]);
    const buffer = EventBuffer.create(opened.originMs);
    buffer.recordAt(opened.entries[0]!.type, opened.entries[0]!.payload, opened.entries[0]!.at);
    expect(buffer.snapshot()[0]).toMatchObject({ seq: 1, t: 0, type: "session_start" });
  });
});
