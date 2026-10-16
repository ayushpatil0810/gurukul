import { editorEventTypes, reconstructDocument } from "@/lib/engine/editor-events";
import { SERVER_SEQ_BASE } from "@/lib/engine/event-chain";

export type ReplaySourceEvent = {
  seq: number;
  t: number;
  type: string;
  payload: unknown;
  chainIndex?: number | null;
  schemaVersion?: number | null;
};

export type UnplayableReason =
  | "legacy_or_incomplete"
  | "removed_mismatch"
  | "overlapping_changes"
  | "missing_baseline"
  | "sequence_gap";

export type ReplayMarker = "edit" | "run" | "submit" | "quality";

export type ReplaySpan = {
  fromSeq: number;
  toSeq: number;
  fromT: number;
  toT: number;
};

export type ReplayDetail = {
  label: string;
  note: string | null;
  outcome: string | null;
  gap: { missingFrom: number; missingTo: number; resolved: boolean } | null;
};

export type ReplayFrame = {
  index: number;
  seq: number;
  t: number;
  type: string;
  chainIndex: number | null;
  playable: boolean;
  text: string | null;
  reason: UnplayableReason | null;
  span: ReplaySpan | null;
  marker: ReplayMarker | null;
  detail: ReplayDetail;
};

export type ReplayMoment = {
  playable: boolean;
  text: string | null;
  reason: UnplayableReason | null;
};

export type ReplayTimeline = {
  frames: ReplayFrame[];
  durationMs: number;
  opening: ReplayMoment;
};

const editorTypes = new Set<string>(editorEventTypes);

type Stored = {
  seq: number;
  t: number;
  type: string;
  payload: unknown;
  chainIndex: number | null;
};

type StartEvent = Stored & { baseline: string };

export function replayWarning(reason: UnplayableReason): { title: string; body: string } {
  const notice = "This is a limit of the recording, not evidence of misconduct.";
  switch (reason) {
    case "legacy_or_incomplete":
      return {
        title: "This part of the recording cannot be rebuilt",
        body: `The event does not include the inserted text, the removed text, or the range. No code is filled in. ${notice}`,
      };
    case "removed_mismatch":
      return {
        title: "The recorded edit does not match the editor",
        body: `The characters the event expected to replace are not in the document at that point. Later code in this span is not shown. ${notice}`,
      };
    case "overlapping_changes":
      return {
        title: "Overlapping edits cannot be rebuilt",
        body: `More than one change in the same step covers the same position. There is no single document to show. ${notice}`,
      };
    case "missing_baseline":
      return {
        title: "No starting document was recorded",
        body: `The session has no baseline, so the editor cannot be rebuilt. An empty program is a different state and is labeled separately. ${notice}`,
      };
    case "sequence_gap":
      return {
        title: "Some events in this range were not stored",
        body: `The missing events are left blank. Playback does not invent the code that would have filled the gap. ${notice}`,
      };
  }
}

export function buildReplayTimeline(input: readonly ReplaySourceEvent[]): ReplayTimeline {
  const events: Stored[] = input.map((event) => ({
    seq: event.seq,
    t: event.t,
    type: event.type,
    payload: event.payload === undefined ? null : structuredClone(event.payload),
    chainIndex: event.chainIndex ?? null,
  }));
  const starts: StartEvent[] = events
    .filter((event): event is StartEvent => event.type === "session_start" && baselineOf(event) !== null)
    .map((event) => ({ ...event, baseline: baselineOf(event) as string }))
    .sort((left, right) => left.seq - right.seq);
  const playback = [...events].sort((left, right) => left.t - right.t || left.seq - right.seq);

  const frames: ReplayFrame[] = playback.map((event, index) => {
    const occurred = playback.slice(0, index + 1);
    const state = documentState(occurred, starts);
    return {
      index,
      seq: event.seq,
      t: event.t,
      type: event.type,
      chainIndex: event.chainIndex,
      playable: state.playable,
      text: state.text,
      reason: state.reason,
      span: null,
      marker: markerFor(event.type),
      detail: detailFor(event),
    };
  });
  assignSpans(frames);

  return {
    frames,
    durationMs: frames.reduce((max, frame) => Math.max(max, frame.t), 0),
    opening: documentState([], starts),
  };
}

function documentState(occurred: readonly Stored[], starts: readonly StartEvent[]): ReplayMoment {
  if (starts.length === 0) return { playable: false, text: null, reason: "missing_baseline" };
  if (occurred.length === 0) return { playable: true, text: starts[0]!.baseline, reason: null };

  const anchorSeq = occurred
    .filter((event) => event.type !== "data_quality")
    .reduce((max, event) => Math.max(max, event.seq), 0);
  const active = segmentIndex(anchorSeq, starts);
  const start = starts[active]!;
  const editors = occurred.filter(
    (event) => editorTypes.has(event.type) && segmentIndex(event.seq, starts) === active,
  );
  if (crossesHole(active, starts, editors, occurred)) {
    return { playable: false, text: null, reason: "sequence_gap" };
  }

  const result = reconstructDocument("", [start, ...editors]);
  if (!result.ok) return { playable: false, text: null, reason: result.reason };
  return { playable: true, text: result.text, reason: null };
}

function segmentIndex(seq: number, starts: readonly StartEvent[]): number {
  let index = 0;
  for (let cursor = 0; cursor < starts.length; cursor += 1) {
    if (starts[cursor]!.seq <= seq) index = cursor;
  }
  return index;
}

function crossesHole(
  active: number,
  starts: readonly StartEvent[],
  editors: readonly Stored[],
  occurred: readonly Stored[],
): boolean {
  const present = new Set(
    occurred.filter((event) => event.seq < SERVER_SEQ_BASE && event.type !== "data_quality").map((event) => event.seq),
  );
  const from = active === 0 ? 1 : starts[active]!.seq + 1;
  return editors.some((event) => {
    for (let seq = from; seq < event.seq; seq += 1) {
      if (!present.has(seq)) return true;
    }
    return false;
  });
}

function assignSpans(frames: ReplayFrame[]) {
  let cursor = 0;
  while (cursor < frames.length) {
    const reason = frames[cursor]!.reason;
    if (!reason || frames[cursor]!.playable) {
      cursor += 1;
      continue;
    }
    let end = cursor;
    while (end + 1 < frames.length && !frames[end + 1]!.playable && frames[end + 1]!.reason === reason) end += 1;
    const span: ReplaySpan = {
      fromSeq: frames[cursor]!.seq,
      toSeq: frames[end]!.seq,
      fromT: frames[cursor]!.t,
      toT: frames[end]!.t,
    };
    for (let index = cursor; index <= end; index += 1) frames[index]!.span = span;
    cursor = end + 1;
  }
}

function baselineOf(event: Stored): string | null {
  if (!event.payload || typeof event.payload !== "object") return null;
  const baseline = (event.payload as { baseline?: unknown }).baseline;
  return typeof baseline === "string" ? baseline : null;
}

function markerFor(type: string): ReplayMarker | null {
  if (editorTypes.has(type)) return "edit";
  if (type === "run" || type === "run_result") return "run";
  if (type === "submit" || type === "submit_result") return "submit";
  if (type === "data_quality") return "quality";
  return null;
}

function detailFor(event: Stored): ReplayDetail {
  const payload = event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : {};
  if (event.type === "data_quality") {
    const gap = readGap(payload);
    return {
      label: gap?.resolved ? "Recording gap resolved" : "Recording gap",
      note: "Missing events stay missing. A gap is not a finding about the student.",
      outcome: null,
      gap,
    };
  }
  if (editorTypes.has(event.type)) {
    const inserted = typeof payload.length === "number" ? payload.length : null;
    const removed = typeof payload.removedLength === "number" ? payload.removedLength : null;
    const counts =
      inserted === null && removed === null ? "text was not stored" : `${inserted ?? 0} inserted, ${removed ?? 0} removed`;
    return { label: `${labelFor(event.type)} (${counts})`, note: null, outcome: null, gap: null };
  }
  if (event.type === "run_result" && Array.isArray(payload.outcomes)) {
    return {
      label: "Run result",
      note: null,
      outcome: payload.outcomes.filter((item) => typeof item === "string").join(", ") || null,
      gap: null,
    };
  }
  if (event.type === "submit_result") {
    const passed = typeof payload.passed === "number" ? payload.passed : null;
    const total = typeof payload.total === "number" ? payload.total : null;
    const categories = Array.isArray(payload.categories)
      ? payload.categories.filter((item) => typeof item === "string").join(", ")
      : "";
    const score = passed !== null && total !== null ? `${passed} of ${total} hidden tests passed` : "Submission recorded";
    return { label: "Submission result", note: categories || null, outcome: score, gap: null };
  }
  if (event.type === "run" || event.type === "submit") {
    const language = typeof payload.language === "string" ? payload.language : null;
    return { label: labelFor(event.type), note: language, outcome: null, gap: null };
  }
  return { label: labelFor(event.type), note: null, outcome: null, gap: null };
}

function readGap(payload: Record<string, unknown>): { missingFrom: number; missingTo: number; resolved: boolean } | null {
  const resolved = payload.resolved === true;
  if (typeof payload.missing === "number" && Number.isInteger(payload.missing)) {
    return { missingFrom: payload.missing, missingTo: payload.missing, resolved };
  }
  if (
    typeof payload.missingFrom === "number" &&
    typeof payload.missingTo === "number" &&
    Number.isInteger(payload.missingFrom) &&
    Number.isInteger(payload.missingTo)
  ) {
    return { missingFrom: payload.missingFrom, missingTo: payload.missingTo, resolved };
  }
  return null;
}

function labelFor(type: string): string {
  return type.replaceAll("_", " ");
}

export function replayDocument(timeline: ReplayTimeline, frameIndex: number): ReplayMoment {
  const frame = frameIndex < 0 ? timeline.opening : timeline.frames[frameIndex];
  if (!frame) return timeline.opening;
  return { playable: frame.playable, text: frame.text, reason: frame.reason };
}
