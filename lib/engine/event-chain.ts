import { createHash } from "node:crypto";

/** Client sequence numbers stop at 1_000_000. Notes written by the server start here. */
export const SERVER_SEQ_BASE = 1_000_001;
export const EVENT_SCHEMA_VERSION = 2;

export type TimelineEvent = {
  seq: number;
  t: number;
  type: string;
  payload: unknown;
  prevHash: string | null;
  chainIndex: number;
  schemaVersion: number;
};

export type IncomingTimelineEvent = {
  seq: number;
  t: number;
  type: string;
  payload: unknown;
};

export type ExistingTimelineEvent = IncomingTimelineEvent & {
  prevHash: string | null;
  chainIndex?: number;
  schemaVersion?: number;
};

type GapRange = { from: number; to: number };

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function hashEvent(event: {
  seq: number;
  t: number;
  type: string;
  payload: unknown;
  prevHash: string | null;
}): string {
  return createHash("sha256")
    .update(
      stableJson({
        prevHash: event.prevHash,
        seq: event.seq,
        t: event.t,
        type: event.type,
        payload: event.payload,
      }),
    )
    .digest("hex");
}

/**
 * Append plan. Client events stay on their own sequence numbers. Duplicates are
 * ignored, so the original timestamp remains. A hole in the client sequence is
 * recorded as a data-quality note on a server sequence and is never treated as
 * misconduct. A later delivery of the missing event is stored and the hole is
 * marked resolved. The hash chain follows append order (`chainIndex`).
 */
export function planEventAppend(
  existing: readonly ExistingTimelineEvent[],
  incoming: readonly IncomingTimelineEvent[],
): TimelineEvent[] {
  const bySeq = new Map<number, TimelineEvent>();
  const normalized = normalize(existing);
  for (const event of normalized) bySeq.set(event.seq, event);

  let chainIndex = normalized.reduce((max, event) => Math.max(max, event.chainIndex), 0);
  let nextServerSeq = SERVER_SEQ_BASE;
  for (const event of normalized) {
    if (event.seq >= nextServerSeq) nextServerSeq = event.seq + 1;
  }
  let tail: TimelineEvent | null = normalized.at(-1) ?? null;
  const planned: TimelineEvent[] = [];
  const noted = new Set(openGaps(normalized).keys());

  const push = (event: { seq: number; t: number; type: string; payload: unknown; schemaVersion: number }) => {
    chainIndex += 1;
    const stored: TimelineEvent = {
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: event.payload,
      schemaVersion: event.schemaVersion,
      chainIndex,
      prevHash: tail ? hashEvent(tail) : null,
    };
    tail = stored;
    bySeq.set(stored.seq, stored);
    planned.push(stored);
  };

  const orderedIncoming = [...incoming].sort((left, right) => left.seq - right.seq);
  for (const event of orderedIncoming) {
    if (event.type === "data_quality") continue;
    if (!Number.isInteger(event.seq) || event.seq < 1 || event.seq >= SERVER_SEQ_BASE) continue;
    if (bySeq.has(event.seq)) continue;

    for (const range of missingRanges(event.seq, occupiedSeqs(bySeq))) {
      const key = gapKey(range);
      if (noted.has(key)) continue;
      noted.add(key);
      const seq = nextServerSeq;
      nextServerSeq += 1;
      push({
        seq,
        t: event.t,
        type: "data_quality",
        schemaVersion: EVENT_SCHEMA_VERSION,
        payload: {
          missingFrom: range.from,
          missingTo: range.to,
          reason: "sequence_gap",
          interpretation: "missing_telemetry",
          misconduct: false,
        },
      });
    }

    push({
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: event.payload,
      schemaVersion: EVENT_SCHEMA_VERSION,
    });
  }

  const combined = [...normalized, ...planned];
  for (const range of openGaps(combined).values()) {
    if (!rangeFilled(range, bySeq)) continue;
    const seq = nextServerSeq;
    nextServerSeq += 1;
    const filler = [...orderedIncoming].reverse().find((event) => event.seq >= range.from && event.seq <= range.to);
    push({
      seq,
      t: filler?.t ?? tail?.t ?? 0,
      type: "data_quality",
      schemaVersion: EVENT_SCHEMA_VERSION,
      payload: {
        missingFrom: range.from,
        missingTo: range.to,
        reason: "sequence_gap_resolved",
        interpretation: "missing_telemetry",
        misconduct: false,
        resolved: true,
      },
    });
  }

  return planned;
}

export function seqsToAcknowledge(
  stored: readonly { seq: number; type: string }[],
  incoming: readonly number[],
): number[] {
  return incoming.filter((seq) => {
    const row = stored.find((item) => item.seq === seq);
    if (!row) return false;
    if (row.type !== "data_quality") return true;
    return row.seq < SERVER_SEQ_BASE;
  });
}

export function verifyEventChain(events: readonly ExistingTimelineEvent[]): boolean {
  const ordered = normalize(events);
  let previous: TimelineEvent | null = null;
  const seen = new Set<number>();
  for (const event of ordered) {
    if (seen.has(event.chainIndex)) return false;
    seen.add(event.chainIndex);
    const expected = previous ? hashEvent(previous) : null;
    if (event.prevHash !== expected) return false;
    previous = event;
  }
  return true;
}

function normalize(events: readonly ExistingTimelineEvent[]): TimelineEvent[] {
  return events
    .map((event) => ({
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: event.payload,
      prevHash: event.prevHash,
      chainIndex: event.chainIndex ?? event.seq,
      schemaVersion: event.schemaVersion ?? 1,
    }))
    .sort((left, right) => left.chainIndex - right.chainIndex || left.seq - right.seq);
}

function occupiedSeqs(bySeq: ReadonlyMap<number, TimelineEvent>): number[] {
  const seqs: number[] = [];
  for (const [seq, event] of bySeq) {
    if (seq >= SERVER_SEQ_BASE) continue;
    if (event.type === "data_quality" && event.seq >= SERVER_SEQ_BASE) continue;
    seqs.push(seq);
  }
  return seqs;
}

function missingRanges(seq: number, occupied: readonly number[]): GapRange[] {
  const below = occupied.filter((value) => value > 0 && value < seq).sort((left, right) => left - right);
  const ranges: GapRange[] = [];
  let cursor = 1;
  for (const present of below) {
    if (present > cursor) ranges.push({ from: cursor, to: present - 1 });
    cursor = Math.max(cursor, present + 1);
  }
  if (cursor < seq) ranges.push({ from: cursor, to: seq - 1 });
  return ranges;
}

function openGaps(events: readonly TimelineEvent[]): Map<string, GapRange> {
  const resolved = new Set<string>();
  const opened = new Map<string, GapRange>();
  for (const event of events) {
    if (event.type !== "data_quality") continue;
    const gap = readGap(event.payload);
    if (!gap) continue;
    const key = gapKey(gap);
    if (gap.resolved) resolved.add(key);
    else opened.set(key, { from: gap.from, to: gap.to });
  }
  for (const key of resolved) opened.delete(key);
  return opened;
}

function readGap(payload: unknown): (GapRange & { resolved: boolean }) | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const resolved = record.resolved === true;
  if (typeof record.missing === "number" && Number.isInteger(record.missing)) {
    return { from: record.missing, to: record.missing, resolved };
  }
  if (
    typeof record.missingFrom === "number" &&
    typeof record.missingTo === "number" &&
    Number.isInteger(record.missingFrom) &&
    Number.isInteger(record.missingTo) &&
    record.missingFrom >= 1 &&
    record.missingTo >= record.missingFrom
  ) {
    return { from: record.missingFrom, to: record.missingTo, resolved };
  }
  return null;
}

function rangeFilled(range: GapRange, bySeq: ReadonlyMap<number, TimelineEvent>): boolean {
  for (let seq = range.from; seq <= range.to; seq += 1) {
    const found = bySeq.get(seq);
    if (!found || found.type === "data_quality") return false;
  }
  return true;
}

function gapKey(range: GapRange): string {
  return `${range.from}-${range.to}`;
}
