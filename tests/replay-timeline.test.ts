import { describe, expect, it } from "vitest";

import { reconstructDocument } from "@/lib/engine/editor-events";
import { advancePlayhead, frameIndexAtTime, stepFrame } from "@/lib/engine/replay-playback";
import {
  buildReplayTimeline,
  replayDocument,
  replayWarning,
  type ReplaySourceEvent,
} from "@/lib/engine/replay-timeline";

function insert(at: number, text: string) {
  return {
    schemaVersion: 2,
    range: { start: at, end: at },
    text,
    removed: "",
    length: text.length,
    removedLength: 0,
  };
}

function validSession(): ReplaySourceEvent[] {
  const baseline = "let n = ";
  return [
    { seq: 1, t: 0, type: "session_start", payload: { mode: "practice", baseline }, chainIndex: 1 },
    { seq: 2, t: 400, type: "insert", payload: insert(baseline.length, "1"), chainIndex: 2 },
    { seq: 3, t: 800, type: "run", payload: { language: "javascript" }, chainIndex: 3 },
    { seq: 4, t: 900, type: "run_result", payload: { outcomes: ["ok"] }, chainIndex: 4 },
  ];
}

describe("replay timeline", () => {
  it("reconstructs a valid session from the baseline and editor events", () => {
    const events = validSession();
    const timeline = buildReplayTimeline(events);
    expect(timeline.opening).toEqual({ playable: true, text: "let n = ", reason: null });
    expect(replayDocument(timeline, 1)).toEqual({ playable: true, text: "let n = 1", reason: null });
    const rebuilt = reconstructDocument(
      "starter",
      events.filter((event) => event.seq <= 2),
    );
    expect(rebuilt).toEqual({ ok: true, text: "let n = 1" });
  });

  it("reaches the same text by playback and by seeking", () => {
    const events = validSession();
    const timeline = buildReplayTimeline(events);
    const playedTime = advancePlayhead({ timeMs: 0, elapsedMs: 400, speed: 1, durationMs: timeline.durationMs });
    const playedIndex = frameIndexAtTime(timeline.frames, playedTime);
    const soughtIndex = frameIndexAtTime(timeline.frames, 400);
    expect(playedIndex).toBe(soughtIndex);
    expect(replayDocument(timeline, playedIndex).text).toBe(replayDocument(timeline, soughtIndex).text);
    expect(replayDocument(timeline, playedIndex).text).toBe("let n = 1");
  });

  it("pauses, resumes, and seeks without applying an edit twice", () => {
    const events = validSession();
    const frozen = structuredClone(events);
    const timeline = buildReplayTimeline(events);
    let time = advancePlayhead({ timeMs: 0, elapsedMs: 400, speed: 2, durationMs: timeline.durationMs });
    const paused = advancePlayhead({ timeMs: time, elapsedMs: 0, speed: 1, durationMs: timeline.durationMs });
    expect(paused).toBe(time);
    time = advancePlayhead({ timeMs: paused, elapsedMs: 200, speed: 1, durationMs: timeline.durationMs });
    const index = frameIndexAtTime(timeline.frames, time);
    expect(replayDocument(timeline, index).text).toBe("let n = 1");
    const beforeEdit = stepFrame(frameIndexAtTime(timeline.frames, 400), -1, timeline.frames.length);
    expect(replayDocument(timeline, beforeEdit).text).toBe("let n = ");
    expect(events).toEqual(frozen);
    expect(timeline.frames[1]?.text).toBe("let n = 1");
  });

  it("leaves the buffer unchanged for run, submit, focus, and data-quality events", () => {
    const baseline = "code";
    const events: ReplaySourceEvent[] = [
      { seq: 1, t: 0, type: "session_start", payload: { baseline } },
      {
        seq: 2,
        t: 100,
        type: "insert",
        payload: insert(4, "!"),
      },
      { seq: 3, t: 200, type: "focus", payload: {} },
      { seq: 4, t: 300, type: "run", payload: { language: "javascript" } },
      { seq: 5, t: 400, type: "submit", payload: { language: "javascript" } },
      {
        seq: 1_000_001,
        t: 500,
        type: "data_quality",
        payload: { missingFrom: 9, missingTo: 9, reason: "sequence_gap", misconduct: false },
      },
    ];
    const timeline = buildReplayTimeline(events);
    const texts = timeline.frames.slice(1).map((frame) => frame.text);
    expect(texts).toEqual(["code!", "code!", "code!", "code!", "code!"]);
    expect(timeline.frames[5]?.detail.gap).toMatchObject({ missingFrom: 9, missingTo: 9, resolved: false });
    expect(replayWarning("sequence_gap").body).toContain("not evidence of misconduct");
  });

  it("does not fabricate a document for a legacy or incomplete event", () => {
    const events: ReplaySourceEvent[] = [
      { seq: 1, t: 0, type: "session_start", payload: { baseline: "ab" } },
      { seq: 2, t: 100, type: "insert", payload: insert(2, "c") },
      { seq: 3, t: 200, type: "insert", payload: { length: 4 } },
    ];
    const timeline = buildReplayTimeline(events);
    expect(timeline.frames[1]).toMatchObject({ playable: true, text: "abc" });
    expect(timeline.frames[2]).toMatchObject({ playable: false, text: null, reason: "legacy_or_incomplete" });
    expect(timeline.frames[2]?.span).toMatchObject({ fromSeq: 3, toSeq: 3 });
  });

  it("marks overlapping changes unplayable", () => {
    const events: ReplaySourceEvent[] = [
      { seq: 1, t: 0, type: "session_start", payload: { baseline: "abcd" } },
      {
        seq: 2,
        t: 100,
        type: "insert",
        payload: { ...insert(1, "X"), overlap: true },
      },
    ];
    const timeline = buildReplayTimeline(events);
    expect(timeline.frames[1]).toMatchObject({ playable: false, text: null, reason: "overlapping_changes" });
    expect(replayDocument(timeline, 0).text).toBe("abcd");
  });

  it("surfaces a missing baseline and an unresolved sequence gap", () => {
    const missing = buildReplayTimeline([
      { seq: 1, t: 0, type: "insert", payload: insert(0, "x") },
    ]);
    expect(missing.opening).toEqual({ playable: false, text: null, reason: "missing_baseline" });
    expect(missing.frames[0]).toMatchObject({ playable: false, text: null, reason: "missing_baseline" });

    const baseline = "let value = ";
    const gapped = buildReplayTimeline([
      { seq: 1, t: 0, type: "session_start", payload: { baseline } },
      { seq: 2, t: 200, type: "insert", payload: insert(baseline.length, "1") },
      { seq: 4, t: 600, type: "insert", payload: insert(baseline.length + 1, ";") },
      {
        seq: 1_000_001,
        t: 600,
        type: "data_quality",
        payload: { missingFrom: 3, missingTo: 3, reason: "sequence_gap", resolved: false },
      },
    ]);
    expect(gapped.frames[1]).toMatchObject({ playable: true, text: "let value = 1" });
    expect(gapped.frames[2]).toMatchObject({ playable: false, text: null, reason: "sequence_gap" });
    expect(gapped.frames[2]?.text).toBeNull();
  });

  it("plays a later baseline after an unplayable span without inventing the span", () => {
    const events: ReplaySourceEvent[] = [
      { seq: 1, t: 0, type: "session_start", payload: { baseline: "before" } },
      { seq: 2, t: 100, type: "insert", payload: { length: 1 } },
      { seq: 3, t: 400, type: "session_start", payload: { baseline: "after" } },
      { seq: 4, t: 500, type: "insert", payload: insert(5, "!") },
    ];
    const timeline = buildReplayTimeline(events);
    expect(timeline.frames[1]).toMatchObject({ playable: false, text: null, reason: "legacy_or_incomplete" });
    expect(timeline.frames[2]).toMatchObject({ playable: true, text: "after" });
    expect(timeline.frames[3]).toMatchObject({ playable: true, text: "after!" });
  });

  it("uses a baseline recorded after buffered edits", () => {
    const events: ReplaySourceEvent[] = [
      { seq: 1, t: 0, type: "insert", payload: insert(2, "!") },
      { seq: 2, t: 500, type: "session_start", payload: { baseline: "hi" } },
    ];
    const timeline = buildReplayTimeline(events);
    expect(timeline.opening.text).toBe("hi");
    expect(timeline.frames[0]).toMatchObject({ playable: true, text: "hi!" });
    expect(timeline.frames[1]).toMatchObject({ playable: true, text: "hi!" });
  });
});
