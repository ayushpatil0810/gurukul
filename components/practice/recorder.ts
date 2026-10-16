export type ClientEvent = {
  seq: number;
  t: number;
  type: string;
  payload: Record<string, unknown>;
};

const STORAGE_PREFIX = "portal-events:";

export class SessionRecorder {
  private socket: WebSocket | null = null;
  private queue: ClientEvent[] = [];
  private seq = 0;
  private closed = false;
  private reconnectTimer = 0;

  constructor(private readonly sessionId: string) {
    const saved = window.localStorage.getItem(this.storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { seq?: number; queue?: ClientEvent[] };
      this.seq = parsed.seq ?? 0;
      this.queue = parsed.queue ?? [];
    }
    this.connect();
    if (this.queue.length > 0) void this.post();
  }

  record(type: string, payload: Record<string, unknown> = {}) {
    this.seq += 1;
    this.queue.push({
      seq: this.seq,
      t: Math.round(performance.now() * 1000) / 1000,
      type,
      payload,
    });
    this.persist();
    this.flush();
  }

  dispose() {
    this.closed = true;
    window.clearTimeout(this.reconnectTimer);
    if (this.queue.length > 0) {
      void fetch(`/api/sessions/${this.sessionId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: this.queue }),
        keepalive: true,
      });
    }
    this.socket?.close();
  }

  private get storageKey() {
    return `${STORAGE_PREFIX}${this.sessionId}`;
  }

  private persist() {
    window.localStorage.setItem(this.storageKey, JSON.stringify({ seq: this.seq, queue: this.queue }));
  }

  private connect() {
    if (this.closed) return;
    const url = process.env.NEXT_PUBLIC_TELEMETRY_URL ?? "ws://localhost:3001";
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener("open", () => this.flush());
    socket.addEventListener("message", (message) => {
      const body = JSON.parse(String(message.data)) as { ok?: boolean };
      if (body.ok) this.clearSent();
    });
    socket.addEventListener("close", () => {
      if (this.closed) return;
      this.reconnectTimer = window.setTimeout(() => this.connect(), 1000);
      void this.post();
    });
  }

  private flush() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.queue.length === 0) return;
    this.socket.send(JSON.stringify({ sessionId: this.sessionId, events: this.queue }));
  }

  private async post() {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    const response = await fetch(`/api/sessions/${this.sessionId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    if (response.ok) this.clearSent();
  }

  private clearSent() {
    this.queue = [];
    this.persist();
  }
}
