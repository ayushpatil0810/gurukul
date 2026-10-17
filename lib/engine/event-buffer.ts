const EVENT_SCHEMA_VERSION = 2;

export type ClientEvent = {
  seq: number;
  t: number;
  type: string;
  payload: Record<string, unknown>;
};

export type StoredBuffer = {
  seq: number;
  queue: ClientEvent[];
  originMs: number;
};

/**
 * Session-local queue. Sequence numbers are assigned once. An acknowledgement
 * removes only the sequences the server confirmed, so a newer event appended
 * while a batch is in flight stays in the queue.
 */
export class EventBuffer {
  private queue: ClientEvent[];
  private seq: number;
  private originMs: number;

  private constructor(seq: number, queue: ClientEvent[], originMs: number) {
    this.seq = seq;
    this.queue = queue;
    this.originMs = originMs;
  }

  static create(originMs: number): EventBuffer {
    return new EventBuffer(0, [], originMs);
  }

  static restore(saved: Partial<StoredBuffer> | null, now = Date.now()): EventBuffer {
    const queue = (saved?.queue ?? []).map((event) => ({
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: { ...event.payload },
    }));
    const seq = saved?.seq ?? queue.reduce((max, event) => Math.max(max, event.seq), 0);
    return new EventBuffer(seq, queue, saved?.originMs ?? now);
  }

  record(type: string, payload: Record<string, unknown> = {}, now = Date.now()): ClientEvent {
    return this.append(type, payload, now - this.originMs);
  }

  recordAt(type: string, payload: Record<string, unknown>, at: number): ClientEvent {
    return this.append(type, payload, at - this.originMs);
  }

  snapshot(): ClientEvent[] {
    return this.queue.map((event) => ({
      seq: event.seq,
      t: event.t,
      type: event.type,
      payload: structuredClone(event.payload),
    }));
  }

  acknowledge(seqs: readonly number[]): void {
    if (seqs.length === 0) return;
    const confirmed = new Set(seqs);
    this.queue = this.queue.filter((event) => !confirmed.has(event.seq));
  }

  serialize(): StoredBuffer {
    return { seq: this.seq, queue: this.snapshot(), originMs: this.originMs };
  }

  private append(type: string, payload: Record<string, unknown>, t: number): ClientEvent {
    this.seq += 1;
    const event: ClientEvent = {
      seq: this.seq,
      t,
      type,
      payload: { ...payload, schemaVersion: EVENT_SCHEMA_VERSION },
    };
    this.queue.push(event);
    return event;
  }
}

/**
 * A well-formed acknowledgement is an array of integers. Anything else, including
 * an omitted list, is ignored so a bad reply cannot drop queued events.
 */
export function acknowledgementSeqs(acked: unknown): number[] | null {
  if (!Array.isArray(acked)) return null;
  const seqs: number[] = [];
  for (const value of acked) {
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    seqs.push(value);
  }
  return seqs;
}

export function applyAcknowledgement(buffer: EventBuffer, acked: unknown): boolean {
  const seqs = acknowledgementSeqs(acked);
  if (seqs === null) return false;
  buffer.acknowledge(seqs);
  return true;
}

/**
 * After a confirmed acknowledgement, keep uploading when a newer event arrived
 * during the request or when part of the sent batch is still queued. An empty
 * acknowledgement must not schedule another send of the same batch.
 */
export function shouldContinueAfterAck(
  sentSeqs: readonly number[],
  remainingSeqs: readonly number[],
  acked: readonly number[],
): boolean {
  if (remainingSeqs.length === 0) return false;
  const sent = new Set(sentSeqs);
  const acknowledged = new Set(acked);
  const sentProgress = sentSeqs.some((seq) => acknowledged.has(seq));
  return remainingSeqs.some((seq) => !sent.has(seq) || (sentProgress && sent.has(seq)));
}
