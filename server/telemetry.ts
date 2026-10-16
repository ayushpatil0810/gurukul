import { WebSocketServer } from "ws";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { parseRole } from "@/lib/auth-fields";
import type { Actor } from "@/lib/auth/actor";
import { env } from "@/lib/env";
import { appendEvents } from "@/lib/services/events";
import { eventBatchSchema } from "@/lib/validations/assessment";

const port = Number(process.env.TELEMETRY_PORT ?? 3001);
const wss = new WebSocketServer({ port });

wss.on("connection", (socket, request) => {
  void handle(socket, request);
});

console.log(`Telemetry listening on ws://localhost:${port} (${env.NODE_ENV})`);

async function handle(socket: import("ws").WebSocket, request: import("node:http").IncomingMessage) {
  const actor = await actorFromCookie(request.headers.cookie ?? "");
  if (!actor) {
    socket.close(4001, "Sign in required");
    return;
  }

  socket.on("message", (raw) => {
    void receive(socket, actor, raw.toString());
  });
}

async function receive(socket: import("ws").WebSocket, actor: Actor, raw: string) {
  try {
    const body = JSON.parse(raw) as { sessionId?: string; events?: unknown };
    const input = eventBatchSchema.parse({ events: body.events });
    if (!body.sessionId) throw new Error("Session is required");
    await appendEvents(actor, body.sessionId, input.events);
    socket.send(JSON.stringify({ ok: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store events";
    socket.send(JSON.stringify({ ok: false, error: message }));
  }
}

async function actorFromCookie(cookie: string): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
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
}
