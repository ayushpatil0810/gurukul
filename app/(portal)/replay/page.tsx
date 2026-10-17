import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { listReplaySessions } from "@/lib/services/replay";
import { ReplayHub } from "@/components/replay/replay-hub";

export const metadata: Metadata = {
  title: "Session Replay & Telemetry Hub",
  description: "Investigate student keystrokes, review test attempt chronologies, and audit code integrity signals.",
};

async function ReplayScreen() {
  await requireAuth();
  const actor = await getActor();
  if (!actor?.instituteId) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Your account is not assigned to an institute yet.
      </div>
    );
  }
  if (actor.role === "student") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Session Replay is available to trainers and administrators.
      </div>
    );
  }

  const sessions = await listReplaySessions(actor);
  return <ReplayHub sessions={sessions} />;
}

export default function ReplayPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <Suspense
        fallback={
          <div className="space-y-4 animate-pulse">
            <div className="h-32 rounded-2xl bg-muted/60" />
            <div className="h-48 rounded-xl bg-muted/40" />
            <div className="h-96 rounded-xl bg-muted/30" />
          </div>
        }
      >
        <ReplayScreen />
      </Suspense>
    </div>
  );
}

