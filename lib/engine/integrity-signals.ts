import { reconstructDocument } from "@/lib/engine/editor-events";
import { SERVER_SEQ_BASE } from "@/lib/engine/event-chain";
import { formatReplayTime } from "@/lib/engine/replay-playback";

/**
 * Rule version integrity-v1.
 * Thresholds that the PRD states as numbers are used as written.
 * Two phrases in the PRD do not give a number, so this version states them here
 * and stores them on every signal that uses them:
 * - "sustained" means a run of typed changes lasting at least 1000 ms
 * - "coefficient of variation below a calibrated threshold" uses 0.15
 */
export const INTEGRITY_RULE_VERSION = "integrity-v1";

export const LARGE_PASTE_CHARS = 150;
export const LARGE_PASTE_RATIO = 0.4;
export const BURST_CHARS_PER_SECOND = 12;
const BURST_BASELINE_DEVIATIONS = 3;
const BURST_SINGLE_INSERT_CHARS = 80;
const BURST_SUSTAINED_MS = 1000;
export const BASELINE_MIN_SAMPLES = 30;
const FIRST_PASS_MIN_LINES = 30;
const UNIFORM_MIN_TYPED_CHARS = 300;
export const UNIFORM_CV_MAX = 0.15;
export const UNIFORM_MAX_DELETION_RATIO = 0.02;
export const UNIFORM_MAX_PAUSE_MS = 5000;

const POPULATION_CONFIDENCE = 0.45;
const BASELINE_CONFIDENCE = 0.8;

export type IntegrityEvent = {
  seq: number;
  t: number;
  type: string;
  payload: unknown;
};

export type TypingBaseline = {
  meanCps: number;
  sdCps: number;
  samples: number;
};

export type SignalType = "large_paste" | "faster_than_rhythm" | "no_write_run_fix" | "evenly_typed";
export type SignalStrength = "low" | "medium" | "high";

export type IntegrityFinding = {
  type: SignalType;
  strength: SignalStrength;
  confidence: number;
  tStart: number;
  tEnd: number;
  seqStart: number;
  seqEnd: number;
  evidenceSeqs: number[];
  metrics: Record<string, unknown>;
  explanation: string;
  context: string[];
  limitations: string[];
  ruleVersion: string;
  dedupeKey: string;
};

export type WithheldRule = {
  rule: SignalType | "uniform_typing" | "typing_burst" | "large_paste" | "no_iteration";
  reason: string;
};

export type IntegrityDetection = {
  signals: IntegrityFinding[];
  withheld: { rule: string; reason: string }[];
};

const FORBIDDEN = ["cheating", "cheat", "fraud", "guilty", "cheater"];

export function detectSignals(
  events: readonly IntegrityEvent[],
  options: { baseline?: TypingBaseline | null; priorSubmissionTexts?: readonly string[] } = {},
): IntegrityDetection {
  const ordered = [...events].sort((left, right) => left.seq - right.seq || left.t - right.t);
  const gaps = unresolvedHoles(ordered);
  const signals: IntegrityFinding[] = [];
  const withheld: { rule: string; reason: string }[] = [];

  signals.push(...largePastes(ordered, options.priorSubmissionTexts ?? [], gaps, withheld));
  signals.push(...typingBursts(ordered, options.baseline ?? null, gaps, withheld));
  const iteration = writeRunFix(ordered, gaps);
  signals.push(...iteration.signals);
  withheld.push(...iteration.withheld);
  const uniform = uniformTyping(ordered, gaps);
  if (uniform.signal) signals.push(uniform.signal);
  withheld.push(...uniform.withheld);

  for (const signal of signals) assertNeutral(signal.explanation);
  return { signals, withheld };
}

export function coefficientOfVariation(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export function typingSamples(events: readonly IntegrityEvent[]): number[] {
  const typed = singleCharInserts(events);
  const samples: number[] = [];
  for (let index = 1; index < typed.length; index += 1) {
    const gap = typed[index]!.t - typed[index - 1]!.t;
    if (gap > 0) samples.push(1000 / gap);
  }
  return samples;
}

function largePastes(
  events: readonly IntegrityEvent[],
  priorTexts: readonly string[],
  gaps: Gap[],
  withheld: { rule: string; reason: string }[],
): IntegrityFinding[] {
  const rebuilt = reconstructDocument("", events);
  const finalLength = rebuilt.ok ? rebuilt.text.length : null;
  const findings: IntegrityFinding[] = [];
  for (const event of events) {
    if (event.type !== "paste") continue;
    const inserted = insertedCount(event);
    if (inserted === null) {
      withheld.push({
        rule: "large_paste",
        reason: `Paste at sequence ${event.seq} has no character count, so it was not measured.`,
      });
      continue;
    }
    const ratio = finalLength && finalLength > 0 ? inserted / finalLength : null;
    const absolute = inserted >= LARGE_PASTE_CHARS;
    const proportional = ratio !== null && ratio >= LARGE_PASTE_RATIO;
    if (!absolute && !proportional) continue;
    const limitations: string[] = [];
    if (!rebuilt.ok) {
      limitations.push(
        "The final solution could not be rebuilt, so only the 150-character rule was applied. No code was invented.",
      );
    }
    const gapNote = gapNoteFor(gaps, event.seq);
    if (gapNote) limitations.push(gapNote);
    const text = payloadText(event);
    const context = [
      "A paste is recorded clipboard input. It can be the student's own notes, a template, or assistive input.",
    ];
    if (text && priorTexts.some((prior) => prior.length > 0 && prior === text)) {
      context.push("The inserted text matches an earlier submission from this student.");
    }
    const percent = ratio === null ? null : Math.round(ratio * 100);
    const comparison =
      percent === null
        ? "The share of the final solution could not be measured."
        : `That is ${percent}% of the final solution (${finalLength} characters).`;
    findings.push(
      finding({
        type: "large_paste",
        strength: inserted >= 400 || (ratio !== null && ratio >= 0.7) ? "high" : "medium",
        confidence: finalLength === null ? 0.6 : 0.75,
        event,
        end: event,
        evidenceSeqs: [event.seq],
        metrics: {
          insertedCharacters: inserted,
          finalSolutionCharacters: finalLength,
          ratio,
          absoluteThreshold: LARGE_PASTE_CHARS,
          ratioThreshold: LARGE_PASTE_RATIO,
          absoluteRule: absolute,
          proportionalRule: proportional,
        },
        explanation: `${inserted} characters were inserted in a single paste at ${formatReplayTime(event.t)}. ${comparison}`,
        context,
        limitations,
        dedupeKey: `${INTEGRITY_RULE_VERSION}:large_paste:${event.seq}`,
      }),
    );
  }
  return findings;
}

function typingBursts(
  events: readonly IntegrityEvent[],
  baseline: TypingBaseline | null,
  gaps: Gap[],
  withheld: { rule: string; reason: string }[],
): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  const personal =
    baseline !== null && baseline.samples >= BASELINE_MIN_SAMPLES && baseline.sdCps > 0 ? baseline : null;
  if (baseline && !personal) {
    withheld.push({
      rule: "typing_burst",
      reason:
        baseline.samples < BASELINE_MIN_SAMPLES
          ? "Not enough earlier typing samples for a personal baseline. The population rate is used instead."
          : "The personal baseline has no variance, so the population rate is used instead.",
    });
  }

  for (const event of events) {
    if (event.type === "paste" || event.type === "autocomplete_accept") continue;
    if (event.type !== "insert" && event.type !== "replace") continue;
    const inserted = insertedCount(event);
    if (inserted === null || inserted < BURST_SINGLE_INSERT_CHARS) continue;
    findings.push(
      finding({
        type: "faster_than_rhythm",
        strength: inserted >= 200 ? "high" : "medium",
        confidence: 0.6,
        event,
        end: event,
        evidenceSeqs: [event.seq],
        metrics: {
          insertedCharacters: inserted,
          singleInsertThreshold: BURST_SINGLE_INSERT_CHARS,
          paste: false,
          autocomplete: false,
        },
        explanation: `${inserted} characters arrived in one editor change at ${formatReplayTime(event.t)}. The event is not a paste and not an autocomplete acceptance. The recording does not show how the characters were entered.`,
        context: [
          "A large change can come from a template, an editor command, or assistive technology. This does not identify the source.",
        ],
        limitations: gapNoteFor(gaps, event.seq) ? [gapNoteFor(gaps, event.seq)!] : [],
        dedupeKey: `${INTEGRITY_RULE_VERSION}:faster_than_rhythm:insert:${event.seq}`,
      }),
    );
  }

  const groups = typedGroups(events);
  for (const group of groups) {
    const duration = group[group.length - 1]!.t - group[0]!.t;
    const chars = group.reduce((sum, event) => sum + (insertedCount(event) ?? 0), 0);
    if (duration < BURST_SUSTAINED_MS || chars <= 0) continue;
    if (gaps.some((gap) => gap.from < group[group.length - 1]!.seq && gap.to > group[0]!.seq)) {
      withheld.push({
        rule: "typing_burst",
        reason: `A sequence gap overlaps the changes from ${group[0]!.seq} to ${group[group.length - 1]!.seq}, so a typing rate was not calculated for that span.`,
      });
      continue;
    }
    const cps = chars / (duration / 1000);
    const personalLine = personal ? personal.meanCps + BURST_BASELINE_DEVIATIONS * personal.sdCps : null;
    const abovePopulation = cps > BURST_CHARS_PER_SECOND;
    const aboveBaseline = personalLine !== null && cps > personalLine;
    if (!abovePopulation && !aboveBaseline) continue;
    const limitations = personal
      ? []
      : [
          "No usable personal typing baseline is stored. The population threshold of 12 characters per second was used, and confidence is lower.",
        ];
    findings.push(
      finding({
        type: "faster_than_rhythm",
        strength: cps >= 24 || (personalLine !== null && cps > personalLine + personal!.sdCps * 2) ? "high" : "medium",
        confidence: personal ? BASELINE_CONFIDENCE : POPULATION_CONFIDENCE,
        event: group[0]!,
        end: group[group.length - 1]!,
        evidenceSeqs: group.map((event) => event.seq),
        metrics: {
          characters: chars,
          durationMs: duration,
          charactersPerSecond: cps,
          populationThreshold: BURST_CHARS_PER_SECOND,
          sustainedMs: BURST_SUSTAINED_MS,
          baselineMeanCps: personal?.meanCps ?? null,
          baselineSdCps: personal?.sdCps ?? null,
          baselineSamples: baseline?.samples ?? 0,
          baselineDeviations: BURST_BASELINE_DEVIATIONS,
          abovePopulation,
          aboveBaseline,
        },
        explanation: `${chars} characters arrived over ${Math.round(duration)} ms at ${formatReplayTime(group[0]!.t)}, about ${cps.toFixed(1)} characters per second. ${
          aboveBaseline
            ? "That is more than 3 standard deviations above this student's stored baseline."
            : "That is above the population threshold of 12 characters per second."
        }`,
        context: [
          "Fast typing and assistive technology can exceed these rates. The rate is not a claim about intent.",
        ],
        limitations,
        dedupeKey: `${INTEGRITY_RULE_VERSION}:faster_than_rhythm:rate:${group[0]!.seq}`,
      }),
    );
  }
  return findings;
}

function writeRunFix(
  events: readonly IntegrityEvent[],
  gaps: Gap[],
): { signals: IntegrityFinding[]; withheld: { rule: string; reason: string }[] } {
  const signals: IntegrityFinding[] = [];
  const withheld: { rule: string; reason: string }[] = [];
  const submits = events.filter((event) => event.type === "submit");
  if (submits.length === 0) {
    withheld.push({ rule: "no_iteration", reason: "No submission is stored, so the write-run-fix rule was not applied." });
    return { signals, withheld };
  }

  for (const submit of submits) {
    const before = events.filter((event) => event.seq < submit.seq && event.seq < SERVER_SEQ_BASE);
    const hole = gaps.some((gap) => gap.from < submit.seq);
    const runs = before.filter((event) => event.type === "run");
    if (runs.length === 0) {
      if (hole) {
        withheld.push({
          rule: "no_iteration",
          reason: `Events are missing before submission ${submit.seq}. Missing events were not treated as evidence that the student never ran the code.`,
        });
      } else {
        const rebuilt = reconstructDocument(
          "",
          events.filter((event) => event.seq <= submit.seq),
        );
        signals.push(
          finding({
            type: "no_write_run_fix",
            strength: rebuilt.ok && lineCount(rebuilt.text) >= FIRST_PASS_MIN_LINES ? "high" : "medium",
            confidence: 0.7,
            event: submit,
            end: submit,
            evidenceSeqs: [submit.seq],
            metrics: {
              pattern: "no_runs_before_submit",
              runsBeforeSubmit: 0,
              submitSeq: submit.seq,
              recordingComplete: true,
            },
            explanation: `No run is stored before the submission at ${formatReplayTime(submit.t)}. The sequence before that submission has no hole.`,
            context: [
              "A student can run code outside this page. The absence of a run event is not proof of how the solution was written.",
            ],
            limitations: [],
            dedupeKey: `${INTEGRITY_RULE_VERSION}:no_write_run_fix:no_runs:${submit.seq}`,
          }),
        );
      }
    }

    const firstResult = before.find((event) => event.type === "run_result");
    if (!firstResult) continue;
    if (!passedAll(firstResult)) continue;
    if (hole && gaps.some((gap) => gap.from < firstResult.seq)) {
      withheld.push({
        rule: "no_iteration",
        reason: `Events are missing before the first run result at sequence ${firstResult.seq}, so a line count was not used.`,
      });
      continue;
    }
    const rebuilt = reconstructDocument(
      "",
      events.filter((event) => event.seq <= firstResult.seq),
    );
    if (!rebuilt.ok) {
      withheld.push({
        rule: "no_iteration",
        reason: `The editor could not be rebuilt at the first run (${rebuilt.reason}), so the 30-line rule was not applied.`,
      });
      continue;
    }
    const lines = lineCount(rebuilt.text);
    if (lines < FIRST_PASS_MIN_LINES) continue;
    if (hasFailEditRun(before)) continue;
    signals.push(
      finding({
        type: "no_write_run_fix",
        strength: lines >= 60 ? "medium" : "low",
        confidence: 0.55,
        event: firstResult,
        end: submit,
        evidenceSeqs: [firstResult.seq, submit.seq],
        metrics: {
          pattern: "first_run_passed",
          lines,
          lineThreshold: FIRST_PASS_MIN_LINES,
          failEditRun: false,
          firstRunSeq: firstResult.seq,
        },
        explanation: `The first stored run passed every recorded test on a solution of ${lines} lines, and the log has no failed run followed by an edit and another run.`,
        context: [
          "A solution written and checked elsewhere can pass on the first run stored here. This is a pattern in the log, not a conclusion about the student.",
        ],
        limitations: [],
        dedupeKey: `${INTEGRITY_RULE_VERSION}:no_write_run_fix:first_pass:${submit.seq}`,
      }),
    );
  }
  return { signals, withheld };
}

function uniformTyping(
  events: readonly IntegrityEvent[],
  gaps: Gap[],
): { signal: IntegrityFinding | null; withheld: { rule: string; reason: string }[] } {
  const withheld: { rule: string; reason: string }[] = [];
  const typed = singleCharInserts(events);
  const typedChars = typed.length;
  const multi = events.some((event) => {
    if (event.type !== "insert" && event.type !== "replace") return false;
    const count = insertedCount(event);
    return count !== null && count > 1;
  });
  if (multi) {
    withheld.push({
      rule: "uniform_typing",
      reason: "A change inserts more than one character, so the time between keys inside that change is not in the log.",
    });
    return { signal: null, withheld };
  }
  if (typedChars < UNIFORM_MIN_TYPED_CHARS) {
    withheld.push({
      rule: "uniform_typing",
      reason: `${typedChars} single-character typing events are stored. The uniform-rhythm rule needs ${UNIFORM_MIN_TYPED_CHARS}, and shorter or multi-character changes are not turned into a rhythm.`,
    });
    return { signal: null, withheld };
  }
  const spanGaps = gaps.filter((gap) => gap.from < typed[typed.length - 1]!.seq && gap.to > typed[0]!.seq);
  if (spanGaps.length > 0) {
    withheld.push({
      rule: "uniform_typing",
      reason: "A sequence gap falls inside the typed span, so inter-key timing is incomplete and no uniform-rhythm signal was created.",
    });
    return { signal: null, withheld };
  }
  const intervals: number[] = [];
  for (let index = 1; index < typed.length; index += 1) intervals.push(typed[index]!.t - typed[index - 1]!.t);
  if (intervals.some((interval) => interval <= 0)) {
    withheld.push({
      rule: "uniform_typing",
      reason: "Some typing events share a timestamp or are out of order, so inter-key variance was not calculated.",
    });
    return { signal: null, withheld };
  }
  const cv = coefficientOfVariation(intervals);
  if (cv === null) {
    withheld.push({ rule: "uniform_typing", reason: "Inter-key variance could not be calculated." });
    return { signal: null, withheld };
  }
  const deleted = events.reduce((sum, event) => {
    if (event.type !== "delete" && event.type !== "replace") return sum;
    return sum + removedCount(event);
  }, 0);
  const deletionRatio = deleted / typedChars;
  const longestPause = Math.max(...intervals);
  const even = cv < UNIFORM_CV_MAX;
  const fewDeletes = deletionRatio < UNIFORM_MAX_DELETION_RATIO;
  const noLongPause = longestPause <= UNIFORM_MAX_PAUSE_MS;
  if (!even || !fewDeletes || !noLongPause) return { signal: null, withheld };
  return {
    signal: finding({
      type: "evenly_typed",
      strength: cv < 0.05 && deletionRatio === 0 ? "high" : "medium",
      confidence: 0.7,
      event: typed[0]!,
      end: typed[typed.length - 1]!,
      evidenceSeqs: [typed[0]!.seq, typed[typed.length - 1]!.seq],
      metrics: {
        typedCharacters: typedChars,
        typedThreshold: UNIFORM_MIN_TYPED_CHARS,
        coefficientOfVariation: cv,
        cvThreshold: UNIFORM_CV_MAX,
        deletionRatio,
        deletionThreshold: UNIFORM_MAX_DELETION_RATIO,
        longestPauseMs: longestPause,
        pauseThresholdMs: UNIFORM_MAX_PAUSE_MS,
      },
      explanation: `${typedChars} single characters were typed from ${formatReplayTime(typed[0]!.t)} to ${formatReplayTime(typed[typed.length - 1]!.t)}. The inter-key coefficient of variation is ${cv.toFixed(3)}, the deletion ratio is ${(deletionRatio * 100).toFixed(1)}%, and the longest pause is ${Math.round(longestPause)} ms.`,
      context: [
        "An even rhythm can come from a fast typist or from assistive technology. It is not a conclusion about the student.",
      ],
      limitations: [],
      dedupeKey: `${INTEGRITY_RULE_VERSION}:evenly_typed:${typed[0]!.seq}`,
    }),
    withheld,
  };
}

function finding(input: {
  type: SignalType;
  strength: SignalStrength;
  confidence: number;
  event: IntegrityEvent;
  end: IntegrityEvent;
  evidenceSeqs: number[];
  metrics: Record<string, unknown>;
  explanation: string;
  context: string[];
  limitations: string[];
  dedupeKey: string;
}): IntegrityFinding {
  return {
    type: input.type,
    strength: input.strength,
    confidence: input.confidence,
    tStart: input.event.t,
    tEnd: input.end.t,
    seqStart: input.event.seq,
    seqEnd: input.end.seq,
    evidenceSeqs: input.evidenceSeqs,
    metrics: { ...input.metrics, ruleVersion: INTEGRITY_RULE_VERSION },
    explanation: input.explanation,
    context: input.context,
    limitations: input.limitations,
    ruleVersion: INTEGRITY_RULE_VERSION,
    dedupeKey: input.dedupeKey,
  };
}

type Gap = { from: number; to: number };

function unresolvedHoles(events: readonly IntegrityEvent[]): Gap[] {
  const bySeq = new Map(events.filter((event) => event.seq < SERVER_SEQ_BASE).map((event) => [event.seq, event]));
  const real = [...bySeq.values()].filter((event) => event.type !== "data_quality").map((event) => event.seq);
  if (real.length === 0) return [];
  const min = Math.min(...real);
  const max = Math.max(...real);
  const holes: Gap[] = [];
  let cursor: number | null = null;
  const missingAt = (seq: number) => {
    const event = bySeq.get(seq);
    return !event || event.type === "data_quality";
  };
  for (let seq = min; seq <= max; seq += 1) {
    if (!missingAt(seq)) {
      cursor = null;
      continue;
    }
    if (cursor === null) cursor = seq;
    if (seq === max || !missingAt(seq + 1)) {
      holes.push({ from: cursor, to: seq });
      cursor = null;
    }
  }
  const resolved = new Set<string>();
  for (const event of events) {
    if (event.type !== "data_quality") continue;
    const payload = record(event);
    if (payload.reason !== "sequence_gap_resolved") continue;
    if (typeof payload.missingFrom === "number" && typeof payload.missingTo === "number") {
      resolved.add(`${payload.missingFrom}:${payload.missingTo}`);
    }
  }
  return holes.filter((hole) => !resolved.has(`${hole.from}:${hole.to}`));
}

function gapNoteFor(gaps: readonly Gap[], seq: number): string | null {
  if (gaps.length === 0) return null;
  const gap = gaps.find((item) => seq >= item.from && seq <= item.to) ?? gaps[0]!;
  const covering = gaps.some((item) => seq >= item.from && seq <= item.to);
  const scope = covering ? "This event falls in a sequence gap" : "The recording also has a sequence gap";
  return `${scope} (${gap.from}–${gap.to}). That gap is missing telemetry, not a finding about the student. The counted event itself is stored.`;
}

function typedGroups(events: readonly IntegrityEvent[]): IntegrityEvent[][] {
  const typed = events.filter((event) => {
    if (event.type !== "insert" && event.type !== "replace") return false;
    return (insertedCount(event) ?? 0) > 0;
  });
  const groups: IntegrityEvent[][] = [];
  for (const event of typed) {
    const current = groups[groups.length - 1];
    if (!current || event.t - current[current.length - 1]!.t > BURST_SUSTAINED_MS) groups.push([event]);
    else current.push(event);
  }
  return groups;
}

function singleCharInserts(events: readonly IntegrityEvent[]): IntegrityEvent[] {
  return events.filter((event) => event.type === "insert" && insertedCount(event) === 1);
}

function insertedCount(event: IntegrityEvent): number | null {
  const payload = record(event);
  if (typeof payload.text === "string") return payload.text.length;
  if (typeof payload.length === "number" && Number.isFinite(payload.length)) return payload.length;
  return null;
}

function removedCount(event: IntegrityEvent): number {
  const payload = record(event);
  if (typeof payload.removed === "string") return payload.removed.length;
  if (typeof payload.removedLength === "number" && Number.isFinite(payload.removedLength)) return payload.removedLength;
  return 0;
}

function payloadText(event: IntegrityEvent): string | null {
  const payload = record(event);
  return typeof payload.text === "string" ? payload.text : null;
}

function record(event: IntegrityEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : {};
}

function lineCount(text: string): number {
  if (text.length === 0) return 0;
  return text.split("\n").length;
}

function passedAll(event: IntegrityEvent): boolean {
  const payload = record(event);
  if (Array.isArray(payload.outcomes) && payload.outcomes.length > 0) {
    return payload.outcomes.every((item) => item === "ok");
  }
  if (typeof payload.passed === "number" && typeof payload.total === "number" && payload.total > 0) {
    return payload.passed === payload.total;
  }
  return false;
}

function hasFailEditRun(events: readonly IntegrityEvent[]): boolean {
  const editor = new Set(["insert", "delete", "replace", "paste", "undo", "redo", "autocomplete_accept"]);
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.type !== "run_result" || passedAll(event)) continue;
    let edited = false;
    for (let later = index + 1; later < events.length; later += 1) {
      const next = events[later]!;
      if (editor.has(next.type)) edited = true;
      if (edited && next.type === "run") return true;
    }
  }
  return false;
}

function assertNeutral(text: string) {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) {
    if (lower.includes(word)) throw new Error(`Signal copy includes a forbidden word: ${word}`);
  }
}
