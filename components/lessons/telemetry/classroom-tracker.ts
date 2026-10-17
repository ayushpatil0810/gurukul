import type { ClassroomEventType } from "@/lib/services/events";
import type { ClassroomEventItemInput } from "@/lib/validations/classroom-telemetry";

const MAX_BUFFER = 50;
const FLUSH_INTERVAL_MS = 2500;

export class ClassroomTracker {
  private lessonId: string;
  private sessionId: string | null;
  private buffer: ClassroomEventItemInput[] = [];
  private seq = 1;
  private flushTimer: number | null = null;
  private originMs = Date.now();
  private isDisposed = false;

  constructor(lessonId: string, sessionId?: string | null) {
    this.lessonId = lessonId;
    this.sessionId = sessionId?.trim() || null;
  }

  setSessionId(sessionId: string | null | undefined) {
    this.sessionId = sessionId?.trim() || null;
  }

  emit(type: ClassroomEventType, payload: Record<string, unknown> = {}, sceneId?: string) {
    if (this.isDisposed || typeof window === "undefined") return;

    const event: ClassroomEventItemInput = {
      seq: this.seq++,
      t: Math.max(0, Date.now() - this.originMs),
      type,
      sceneId: sceneId || undefined,
      payload,
    };

    this.buffer.push(event);

    if (this.buffer.length >= 8) {
      void this.flush();
    } else if (this.flushTimer === null) {
      this.flushTimer = window.setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  }

  async flush() {
    if (this.buffer.length === 0 || typeof window === "undefined") return;

    const batch = this.buffer.slice(0, MAX_BUFFER);
    this.buffer = this.buffer.slice(batch.length);

    try {
      const response = await fetch(`/api/lessons/${this.lessonId}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: this.lessonId,
          sessionId: this.sessionId,
          events: batch,
        }),
        keepalive: true,
      });

      if (!response.ok) {
        // Soft recover on non-fatal client network glitch
        if (this.buffer.length < MAX_BUFFER) {
          this.buffer.unshift(...batch);
        }
      }
    } catch {
      if (this.buffer.length < MAX_BUFFER) {
        this.buffer.unshift(...batch);
      }
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.flushTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
  }
}
