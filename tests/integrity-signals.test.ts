import { describe, expect, it } from "vitest";
import {
  BURST_CHARS_PER_SECOND,
  coefficientOfVariation,
  detectSignals,
  LARGE_PASTE_CHARS,
  LARGE_PASTE_RATIO,
  UNIFORM_CV_MAX,
  UNIFORM_MAX_DELETION_RATIO,
  UNIFORM_MAX_PAUSE_MS,
  type IntegrityEvent,
} from "@/lib/engine/integrity-signals";

function edit(input: {
  seq: number;
  t: number;
  type: string;
  text?: string;
  removed?: string;
  at?: number;
  extra?: Record<string, unknown>;
}): IntegrityEvent {
  const text = input.text ?? "";
  const removed = input.removed ?? "";
  const at = input.at ?? 0;
  return {
    seq: input.seq,
    t: input.t,
    type: input.type,
    payload: {
      schemaVersion: 2,
      range: { start: at, end: at + removed.length },
      text,
      removed,
      length: text.length,
      removedLength: removed.length,
      ...input.extra,
    },
  };
}

function start(baseline = "", seq = 1): IntegrityEvent {
  return { seq, t: 0, type: "session_start", payload: { baseline } };
}

function submit(seq: number, t = 10_000): IntegrityEvent {
  return { seq, t, type: "submit", payload: { language: "javascript" } };
}

describe("integrity signals", () => {
  it("flags a paste at the absolute and proportional boundaries and ignores a smaller one", () => {
    const small = detectSignals([
      start("a".repeat(400)),
      edit({ seq: 2, t: 2000, type: "paste", text: "b".repeat(LARGE_PASTE_CHARS - 1), at: 400 }),
      submit(3),
    ]);
    expect(small.signals.map((signal) => signal.type)).not.toContain("large_paste");

    const absolute = detectSignals([
      start("a".repeat(400)),
      edit({ seq: 2, t: 4120, type: "paste", text: "b".repeat(LARGE_PASTE_CHARS), at: 400 }),
    ]);
    const paste = absolute.signals.find((signal) => signal.type === "large_paste");
    expect(paste?.tStart).toBe(4120);
    expect(paste?.metrics).toMatchObject({ insertedCharacters: LARGE_PASTE_CHARS, absoluteRule: true });
    expect(JSON.stringify(paste)).not.toContain("b".repeat(20));

    const proportional = detectSignals([
      start("a".repeat(150)),
      edit({ seq: 2, t: 3000, type: "paste", text: "c".repeat(100), at: 150 }),
    ]);
    const share = proportional.signals.find((signal) => signal.type === "large_paste");
    expect(share?.metrics.ratio).toBeCloseTo(LARGE_PASTE_RATIO);
    expect(share?.metrics.proportionalRule).toBe(true);

    const underRatio = detectSignals([
      start("a".repeat(200)),
      edit({ seq: 2, t: 3000, type: "paste", text: "c".repeat(99), at: 200 }),
    ]);
    expect(underRatio.signals.some((signal) => signal.type === "large_paste")).toBe(false);
  });

  it("does not treat a counted paste as manually typed, and flags an 80-character change that is neither paste nor autocomplete", () => {
    const pasted = detectSignals([edit({ seq: 1, t: 1000, type: "paste", text: "d".repeat(200) })]);
    expect(pasted.signals.map((signal) => signal.type)).toEqual(["large_paste"]);

    const accepted = detectSignals([
      edit({ seq: 1, t: 1000, type: "autocomplete_accept", text: "e".repeat(100) }),
    ]);
    expect(accepted.signals).toEqual([]);

    expect(detectSignals([edit({ seq: 1, t: 1000, type: "insert", text: "f".repeat(79) })]).signals).toEqual([]);
    const burst = detectSignals([edit({ seq: 1, t: 2500, type: "insert", text: "f".repeat(80) })]);
    expect(burst.signals).toHaveLength(1);
    expect(burst.signals[0]).toMatchObject({
      type: "faster_than_rhythm",
      tStart: 2500,
      metrics: { insertedCharacters: 80, paste: false, autocomplete: false },
    });
    expect(burst.signals[0]?.explanation.toLowerCase()).not.toMatch(/cheat|fraud|guilty/);
  });

  it("uses 12 characters per second and a personal baseline of 3 standard deviations", () => {
    const atPopulation = detectSignals([
      edit({ seq: 1, t: 0, type: "insert", text: "abcdef" }),
      edit({ seq: 2, t: 1000, type: "insert", text: "ghijkl", at: 6 }),
    ]);
    expect(atPopulation.signals.some((signal) => signal.metrics.charactersPerSecond)).toBe(false);

    const abovePopulation = detectSignals([
      edit({ seq: 1, t: 0, type: "insert", text: "abcdef" }),
      edit({ seq: 2, t: 1000, type: "insert", text: "ghijklm", at: 6 }),
    ]);
    const population = abovePopulation.signals.find((signal) => signal.metrics.abovePopulation === true);
    expect(population?.confidence).toBeLessThan(0.5);
    expect(population?.metrics.populationThreshold).toBe(BURST_CHARS_PER_SECOND);
    expect(population?.tStart).toBe(0);
    expect(population?.tEnd).toBe(1000);

    const baseline = { meanCps: 4, sdCps: 2, samples: 40 };
    const atBaseline = detectSignals(
      [
        edit({ seq: 1, t: 0, type: "insert", text: "abcde" }),
        edit({ seq: 2, t: 1000, type: "insert", text: "fghij", at: 5 }),
      ],
      { baseline },
    );
    expect(atBaseline.signals.some((signal) => signal.metrics.aboveBaseline === true)).toBe(false);

    const overBaseline = detectSignals(
      [
        edit({ seq: 1, t: 0, type: "insert", text: "abcde" }),
        edit({ seq: 2, t: 1000, type: "insert", text: "fghijk", at: 5 }),
      ],
      { baseline },
    );
    const personal = overBaseline.signals.find((signal) => signal.metrics.aboveBaseline === true);
    expect(personal?.confidence).toBeGreaterThan(0.7);
    expect(personal?.explanation).toContain("3 standard deviations");
  });

  it("flags a submission with no stored run only when the sequence is complete", () => {
    const complete = detectSignals([start(), submit(2, 8000)]);
    expect(complete.signals.map((signal) => signal.type)).toEqual(["no_write_run_fix"]);
    expect(complete.signals[0]?.tStart).toBe(8000);
    expect(complete.signals[0]?.metrics.pattern).toBe("no_runs_before_submit");

    const gapped = detectSignals([start(), submit(3, 8000)]);
    expect(gapped.signals).toEqual([]);
    expect(gapped.withheld.some((item) => item.reason.includes("Missing events were not treated"))).toBe(true);
  });

  it("flags a first passing run on 30 lines and ignores a normal fail, edit, run loop", () => {
    const lines = (count: number) => Array.from({ length: count }, () => "const n = 1;").join("\n");
    const passed = detectSignals([
      start(lines(30)),
      { seq: 2, t: 1000, type: "run", payload: {} },
      { seq: 3, t: 1100, type: "run_result", payload: { outcomes: ["ok", "ok"] } },
      submit(4, 2000),
    ]);
    expect(passed.signals.map((signal) => signal.metrics.pattern)).toEqual(["first_run_passed"]);
    expect(passed.signals[0]?.tStart).toBe(1100);

    const short = detectSignals([
      start(lines(29)),
      { seq: 2, t: 1000, type: "run", payload: {} },
      { seq: 3, t: 1100, type: "run_result", payload: { outcomes: ["ok"] } },
      submit(4),
    ]);
    expect(short.signals).toEqual([]);

    const loop = detectSignals([
      start(lines(30)),
      { seq: 2, t: 1000, type: "run", payload: {} },
      { seq: 3, t: 1100, type: "run_result", payload: { outcomes: ["runtime_error"] } },
      edit({ seq: 4, t: 1500, type: "insert", text: "a", at: 0 }),
      { seq: 5, t: 2000, type: "run", payload: {} },
      { seq: 6, t: 2100, type: "run_result", payload: { outcomes: ["ok"] } },
      submit(7),
    ]);
    expect(loop.signals).toEqual([]);
  });

  it("flags uniform single-character typing only when every documented condition holds", () => {
    const typed = (count: number) => {
      const events: IntegrityEvent[] = [];
      for (let index = 0; index < count; index += 1) {
        events.push(edit({ seq: index + 1, t: index * 100, type: "insert", text: "a", at: index }));
      }
      return events;
    };

    const even = detectSignals(typed(300));
    expect(even.signals.map((signal) => signal.type)).toEqual(["evenly_typed"]);
    expect(even.signals[0]?.metrics.cvThreshold).toBe(UNIFORM_CV_MAX);
    expect(even.signals[0]?.tStart).toBe(0);

    expect(detectSignals(typed(299)).signals).toEqual([]);
    expect(detectSignals(typed(299)).withheld.some((item) => item.rule === "uniform_typing")).toBe(true);

    const sixDeletes = typed(300);
    for (let index = 0; index < 6; index += 1) {
      sixDeletes.push(edit({ seq: 301 + index, t: 40_000 + index, type: "delete", removed: "a", at: 0 }));
    }
    expect(detectSignals(sixDeletes).signals.some((signal) => signal.type === "evenly_typed")).toBe(false);
    expect(6 / 300).toBe(UNIFORM_MAX_DELETION_RATIO);

    const fiveDeletes = typed(300);
    for (let index = 0; index < 5; index += 1) {
      fiveDeletes.push(edit({ seq: 301 + index, t: 40_000 + index, type: "delete", removed: "a", at: 0 }));
    }
    expect(detectSignals(fiveDeletes).signals.some((signal) => signal.type === "evenly_typed")).toBe(true);

    const steady = (gap: number) => {
      const events: IntegrityEvent[] = [];
      for (let index = 0; index < 300; index += 1) {
        events.push(edit({ seq: index + 1, t: index * gap, type: "insert", text: "a", at: index }));
      }
      return events;
    };
    expect(detectSignals(steady(UNIFORM_MAX_PAUSE_MS)).signals.some((signal) => signal.type === "evenly_typed")).toBe(
      true,
    );
    expect(
      detectSignals(steady(UNIFORM_MAX_PAUSE_MS + 1)).signals.some((signal) => signal.type === "evenly_typed"),
    ).toBe(false);

    const varied: IntegrityEvent[] = [];
    let time = 0;
    for (let index = 0; index < 300; index += 1) {
      if (index > 0) time += index % 2 === 0 ? 50 : 400;
      varied.push(edit({ seq: index + 1, t: time, type: "insert", text: "a", at: index }));
    }
    const intervals: number[] = [];
    for (let index = 1; index < varied.length; index += 1) intervals.push(varied[index]!.t - varied[index - 1]!.t);
    expect(coefficientOfVariation(intervals)).toBeGreaterThan(UNIFORM_CV_MAX);
    expect(detectSignals(varied).signals.some((signal) => signal.type === "evenly_typed")).toBe(false);
  });

  it("does not invent a uniform signal when timing or a paste count is missing", () => {
    const missingPaste = detectSignals([{ seq: 1, t: 10, type: "paste", payload: {} }]);
    expect(missingPaste.signals).toEqual([]);
    expect(missingPaste.withheld.some((item) => item.reason.includes("no character count"))).toBe(true);

    const blob = detectSignals([
      edit({ seq: 1, t: 0, type: "insert", text: "a".repeat(300) }),
    ]);
    expect(blob.signals.some((signal) => signal.type === "evenly_typed")).toBe(false);
    expect(blob.withheld.some((item) => item.reason.includes("more than one character"))).toBe(true);
  });

  it("keeps ordinary edits and a short paste out of the queue", () => {
    const events: IntegrityEvent[] = [start("function total() {\n  return 1;\n}\n")];
    let at = (events[0]!.payload as { baseline: string }).baseline.length;
    for (let index = 0; index < 12; index += 1) {
      events.push(edit({ seq: events.length + 1, t: 500 + index * 180, type: "insert", text: "x", at }));
      at += 1;
    }
    events.push({ seq: events.length + 1, t: 4000, type: "run", payload: {} });
    events.push({ seq: events.length + 1, t: 4200, type: "run_result", payload: { outcomes: ["runtime_error"] } });
    events.push(edit({ seq: events.length + 1, t: 4600, type: "delete", removed: "x", at: at - 1 }));
    events.push({ seq: events.length + 1, t: 5000, type: "run", payload: {} });
    events.push({ seq: events.length + 1, t: 5100, type: "run_result", payload: { outcomes: ["ok"] } });
    events.push(submit(events.length + 1, 6000));
    expect(detectSignals(events).signals).toEqual([]);
  });
});
