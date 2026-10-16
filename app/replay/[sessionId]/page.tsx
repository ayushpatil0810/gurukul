import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { readReplay, type ReplayView } from "@/lib/services/replay";
import { ReplayPlayer } from "@/components/replay/replay-player";

export const metadata: Metadata = {
  title: "Replay session",
};

async function ReplayScreen({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  let replay: ReplayView | null = null;
  let denied: string | null = null;
  try {
    replay = await readReplay(actor, sessionId);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) {
      denied = error.message;
    } else {
      throw error;
    }
  }
  if (!replay) return <p className="text-sm text-muted-foreground">{denied ?? "Recording not found"}</p>;
  return <ReplayPlayer session={replay.session} chainValid={replay.chainValid} events={replay.events} />;
}

export default function ReplaySessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="mb-4 text-sm">
        <Link href="/replay" className="text-muted-foreground underline-offset-4 hover:underline">
          All recordings
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Replay</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the recording…</p>}>
        <ReplayScreen params={params} />
      </Suspense>
    </div>
  );
}
