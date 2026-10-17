import { WebSocketServer } from "ws";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { parseRole } from "@/lib/auth-fields";
import type { Actor } from "@/lib/auth/actor";
import { env } from "@/lib/env";
import { ingestErrorMessage } from "@/lib/engine/ingest-error";
import { appendEvents } from "@/lib/services/events";
import { eventBatchSchema } from "@/lib/validations/assessment";

const port = Number(process.env.TELEMETRY_PORT ?? 3001);
const wss = new WebSocketServer({ port });

wss.on("connection", (socket, request) => {
  void handle(socket, request);
});

console.log(`Telemetry listening on ws://localhost:${port} (${env.NODE_ENV})`);

async function handle(socket: import("ws").WebSocket, request: import("node:http").IncomingMessage) {
  const actor = await actorFromRequest(request);
  if (!actor) {
    console.warn(`[Telemetry] Connection rejected (4001): unauthorized. Cookies: ${request.headers.cookie ? "present" : "none"}`);
    socket.close(4001, "Sign in required");
    return;
  }

  socket.on("message", (raw) => {
    void receive(socket, actor, raw.toString());
  });
}

async function receive(socket: import("ws").WebSocket, actor: Actor, raw: string) {
  let batchId: string | null = null;
  try {
    const body = JSON.parse(raw) as { sessionId?: string; events?: unknown; batchId?: unknown };
    batchId = typeof body.batchId === "string" ? body.batchId : null;
    const input = eventBatchSchema.parse({ events: body.events });
    if (!body.sessionId) throw new Error("Session is required");
    const result = await appendEvents(actor, body.sessionId, input.events);
    socket.send(JSON.stringify({ ok: true, batchId, acked: result.acked }));
  } catch (error) {
    socket.send(JSON.stringify({ ok: false, batchId, error: ingestErrorMessage(error) }));
  }
}

async function actorFromRequest(request: import("node:http").IncomingMessage): Promise<Actor | null> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }
  }
  try {
    const session = await auth.api.getSession({ headers });
    if (!session?.user) return null;
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        instituteId: user.instituteId,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: parseRole(row.role),
      instituteId: row.instituteId,
    };
  } catch (err) {
    console.error("[Telemetry] Failed to resolve actor from headers:", err);
    return null;
  }
}
