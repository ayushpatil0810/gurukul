import { createHash } from "node:crypto";

export type TimelineEvent = {
  seq: number;
  t: number;
  type: string;
  payload: unknown;
  prevHash: string | null;
};

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function hashEvent(event: TimelineEvent): string {
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
 * Append-only plan. Duplicates are ignored. A gap inserts one data_quality
 * event at the first missing sequence so the hole is visible in order.
 */
export function planEventAppend(
  existing: readonly TimelineEvent[],
  incoming: readonly Omit<TimelineEvent, "prevHash">[],
): TimelineEvent[] {
  const bySeq = new Map(existing.map((event) => [event.seq, event]));
  const planned: TimelineEvent[] = [];

  for (const event of [...incoming].sort((left, right) => left.seq - right.seq)) {
    if (bySeq.has(event.seq)) continue;
    const previous = latestBefore(bySeq, event.seq);
    const expected = previous ? previous.seq + 1 : 1;
    if (event.seq > expected && event.seq - expected <= 20) {
      for (let seq = expected; seq < event.seq; seq += 1) {
        const linked = latestBefore(bySeq, seq);
        const note: TimelineEvent = {
          seq,
          t: event.t,
          type: "data_quality",
          payload: { missing: seq },
          prevHash: linked ? hashEvent(linked) : null,
        };
        bySeq.set(note.seq, note);
        planned.push(note);
      }
    } else if (event.seq > expected) {
      const note: TimelineEvent = {
        seq: expected,
        t: event.t,
        type: "data_quality",
        payload: { missingFrom: expected, missingTo: event.seq - 1 },
        prevHash: previous ? hashEvent(previous) : null,
      };
      bySeq.set(note.seq, note);
      planned.push(note);
    }
    const linked = latestBefore(bySeq, event.seq);
    const stored: TimelineEvent = {
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: event.payload,
      prevHash: linked ? hashEvent(linked) : null,
    };
    bySeq.set(stored.seq, stored);
    planned.push(stored);
  }

  return planned;
}

function latestBefore(events: ReadonlyMap<number, TimelineEvent>, seq: number): TimelineEvent | null {
  let best: TimelineEvent | null = null;
  for (const event of events.values()) {
    if (event.seq < seq && (best === null || event.seq > best.seq)) best = event;
  }
  return best;
}
