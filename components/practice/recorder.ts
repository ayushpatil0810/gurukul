import { acknowledgementSeqs, EventBuffer, shouldContinueAfterAck, type ClientEvent } from "@/lib/engine/event-buffer";

export type { ClientEvent };

const STORAGE_PREFIX = "portal-events:";
const MAX_BATCH = 100;

export class SessionRecorder {
  private buffer: EventBuffer;
  private socket: WebSocket | null = null;
  private closed = false;
  private reconnectTimer = 0;
  private posting = false;
  private readonly inflight = new Map<string, number[]>();

  constructor(
    private readonly sessionId: string,
    options?: { originMs?: number },
  ) {
    const saved = window.localStorage.getItem(this.storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { seq?: number; queue?: ClientEvent[]; originMs?: number };
      this.buffer = EventBuffer.restore(parsed);
    } else {
      this.buffer = EventBuffer.create(options?.originMs ?? Date.now());
    }
    this.connect();
    if (this.buffer.snapshot().length > 0) void this.post();
  }

  record(type: string, payload: Record<string, unknown> = {}) {
    this.buffer.record(type, payload, Date.now());
    this.afterRecord();
  }

  recordAt(type: string, payload: Record<string, unknown>, at: number) {
    this.buffer.recordAt(type, payload, at);
    this.afterRecord();
  }

  dispose() {
    this.closed = true;
    window.clearTimeout(this.reconnectTimer);
    const pending = this.buffer.snapshot();
    if (pending.length > 0) {
      void fetch(`/api/sessions/${this.sessionId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: pending.slice(0, MAX_BATCH) }),
        keepalive: true,
      });
    }
    this.socket?.close();
  }

  private afterRecord() {
    this.persist();
    this.flush();
  }

  private get storageKey() {
    return `${STORAGE_PREFIX}${this.sessionId}`;
  }

  private persist() {
    window.localStorage.setItem(this.storageKey, JSON.stringify(this.buffer.serialize()));
  }

  private getTelemetryUrl(): string {
    const configured = process.env.NEXT_PUBLIC_TELEMETRY_URL;
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      if (configured) {
        if (isHttps && configured.startsWith("ws://")) {
          return configured.replace(/^ws:\/\//, "wss://");
        }
        return configured;
      }
      const proto = isHttps ? "wss:" : "ws:";
      return `${proto}//${window.location.host}/telemetry`;
    }
    return configured ?? "ws://localhost:3001";
  }

  private connect() {
    if (this.closed) return;
    try {
      const url = this.getTelemetryUrl();
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.addEventListener("open", () => this.flush());
      socket.addEventListener("message", (message) => {
        let body: { ok?: boolean; acked?: unknown; batchId?: unknown };
        try {
          body = JSON.parse(String(message.data)) as { ok?: boolean; acked?: unknown; batchId?: unknown };
        } catch {
          void this.post();
          return;
        }
        const batchId = typeof body.batchId === "string" ? body.batchId : null;
        if (!body.ok) {
          if (batchId) this.inflight.delete(batchId);
          void this.post();
          return;
        }
        if (batchId) this.inflight.delete(batchId);
        const acked = acknowledgementSeqs(body.acked);
        if (acked === null || acked.length === 0) return;
        this.buffer.acknowledge(acked);
        this.persist();
        this.flush();
      });
      socket.addEventListener("close", () => {
        this.inflight.clear();
        if (this.closed) return;
        this.reconnectTimer = window.setTimeout(() => this.connect(), 1000);
        void this.post();
      });
      socket.addEventListener("error", () => {
        void this.post();
      });
    } catch {
      // Insecure WebSocket blocked by HTTPS or network failure: gracefully fall back to HTTP telemetry
      this.socket = null;
      void this.post();
    }
  }

  private flush() {
    if (this.closed || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      void this.post();
      return;
    }
    const batch = this.buffer.snapshot().slice(0, MAX_BATCH);
    if (batch.length === 0) return;
    const signature = batch.map((event) => event.seq).join(",");
    for (const seqs of this.inflight.values()) {
      if (seqs.join(",") === signature) return;
    }
    const batchId = `${signature}:${this.inflight.size}`;
    this.inflight.set(batchId, batch.map((event) => event.seq));
    this.socket.send(JSON.stringify({ sessionId: this.sessionId, batchId, events: batch }));
  }

  private async post() {
    if (this.posting || this.closed) return;
    const batch = this.buffer.snapshot().slice(0, MAX_BATCH);
    if (batch.length === 0) return;
    this.posting = true;
    let scheduleRest = false;
    try {
      const response = await fetch(`/api/sessions/${this.sessionId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: batch }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { success?: boolean; acked?: unknown };
      if (body.success === false) return;
      const acked = acknowledgementSeqs(body.acked);
      if (acked === null) return;
      this.buffer.acknowledge(acked);
      this.persist();
      scheduleRest = shouldContinueAfterAck(
        batch.map((event) => event.seq),
        this.buffer.snapshot().map((event) => event.seq),
        acked,
      );
    } catch {
      return;
    } finally {
      this.posting = false;
    }
    if (scheduleRest) void this.post();
  }
}
