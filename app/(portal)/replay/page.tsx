import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { listReplaySessions } from "@/lib/services/replay";

export const metadata: Metadata = {
  title: "Replay",
};

async function ReplayList() {
  await requireAuth();
  const actor = await getActor();
  if (!actor?.instituteId) {
    return <p className="text-sm text-muted-foreground">Your account is not assigned to an institute yet.</p>;
  }
  if (actor.role === "student") {
    return <p className="text-sm text-muted-foreground">Replay is available to trainers and admins.</p>;
  }

  const sessions = await listReplaySessions(actor);
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No sessions have been recorded for your batches yet.</p>;
  }

  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/70 overflow-hidden bg-background/50">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/replay/${session.id}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:bg-muted/50"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{session.studentName}</span>
                <span className="rounded bg-secondary/80 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground border border-border/60">
                  {session.mode}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {session.questionStatement.length > 140
                  ? `${session.questionStatement.slice(0, 140)}…`
                  : session.questionStatement}
              </p>
            </div>
            <div className="shrink-0 text-xs font-medium text-primary flex items-center gap-1">
              View Replay &rarr;
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ReplayPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-1 border-b border-border/70 pb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">
            Integrity Diagnostics
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground">Session Replay</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Session Replay</h1>
        <p className="text-sm text-muted-foreground">
          Reconstruct student editor activity keystroke-by-keystroke from recorded telemetry events.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading recorded sessions…</p>}>
          <ReplayList />
        </Suspense>
      </div>
    </div>
  );
}
