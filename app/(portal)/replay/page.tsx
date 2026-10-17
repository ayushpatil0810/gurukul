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
    <ul className="divide-y divide-border rounded-lg border border-border">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link href={`/replay/${session.id}`} className="block px-4 py-3 hover:bg-muted">
            <span className="font-medium">{session.studentName}</span>
            <span className="ml-2 text-sm text-muted-foreground">{session.mode}</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {session.questionStatement.length > 140
                ? `${session.questionStatement.slice(0, 140)}…`
                : session.questionStatement}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ReplayPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Session replay</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Rebuild a student&apos;s editor from the recorded events. Gaps and incomplete events stay blank.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sessions…</p>}>
        <ReplayList />
      </Suspense>
    </div>
  );
}
