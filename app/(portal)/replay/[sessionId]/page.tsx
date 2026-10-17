import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { readReplay, type ReplayView } from "@/lib/services/replay";
import { listReviewQueue } from "@/lib/services/integrity";
import { listSessionExplanations } from "@/lib/services/explain";
import { CheckRecording } from "@/components/review/check-recording";
import { ReplayPlayer } from "@/components/replay/replay-player";

export const metadata: Metadata = {
  title: "Replay session",
};

async function ReplayScreen({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string; from?: string; to?: string }>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
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
  const initialTimeMs = Number(query.t);
  const fromT = Number(query.from);
  const toT = Number(query.to);
  const focus =
    Number.isFinite(fromT) && Number.isFinite(toT) ? { fromT, toT: Number.isFinite(toT) ? toT : fromT } : null;
  const signals =
    actor.role === "student"
      ? []
      : await listReviewQueue(actor, { sessionId });
  const explanations = actor.role === "student" ? [] : await listSessionExplanations(actor, sessionId);
  return (
    <div className="space-y-4">
      {actor.role === "trainer" || actor.role === "admin" ? <CheckRecording sessionId={sessionId} /> : null}
      {explanations.length > 0 ? (
        <section className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
          <h2 className="text-base font-semibold text-foreground">Explain your code</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            These answers are stored separately from the hidden-test score and from review signals.
          </p>
          <div className="mt-4 space-y-6">
            {explanations.map((set) => (
              <article key={set.id} className="space-y-3 text-sm">
                <p className="font-mono text-xs text-muted-foreground">
                  Submission {set.attemptId} · {set.language} · {set.status}
                </p>
                {set.note ? <p className="text-foreground">{set.note}</p> : null}
                <pre className="overflow-auto rounded-md border border-border/70 bg-background/60 p-3 font-mono text-xs">{set.codeSnapshot}</pre>
                <ol className="space-y-3">
                  {set.questions.map((question) => (
                    <li key={question.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="font-medium text-foreground">{question.prompt}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Lines {question.startLine}–{question.endLine}: {question.quote}
                      </p>
                      <p className="mt-2 text-sm text-foreground">Answer: {question.answer ?? "Not answered yet"}</p>
                      {set.status === "answered" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {question.verdictLabel ?? "Not enough evidence"}
                          {question.reviewStatus === "needs_review" ? " · Needs review" : ""}
                          {question.method ? ` · ${question.method}` : ""}
                          {question.confidence !== null ? ` · confidence ${question.confidence}` : ""}
                        </p>
                      ) : null}
                      {question.evidence.map((item) => (
                        <p key={item} className="text-xs text-emerald-400/90 font-mono mt-1">{item}</p>
                      ))}
                      {question.missed.map((item) => (
                        <p key={item} className="text-xs text-amber-400/90 font-mono mt-1">{item}</p>
                      ))}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {signals.length > 0 ? (
        <section className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
          <h2 className="text-base font-semibold text-foreground">Review signals in this recording</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            These are patterns for a person to interpret. They do not change a grade or a mastery value.
          </p>
          <ul className="mt-3 space-y-2">
            {signals.map((signal) => (
              <li key={signal.id}>
                <Link href={signal.replayHref} className="text-sm text-primary underline-offset-4 hover:underline">
                  {signal.explanation}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ReplayPlayer
        session={replay.session}
        chainValid={replay.chainValid}
        events={replay.events}
        initialTimeMs={Number.isFinite(initialTimeMs) ? initialTimeMs : 0}
        focus={focus}
      />
    </div>
  );
}

export default function ReplaySessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string; from?: string; to?: string }>;
}) {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2 border-b border-border/70 pb-5">
        <div className="flex items-center gap-2">
          <Link href="/replay" className="text-xs font-semibold uppercase tracking-wider text-primary font-mono hover:underline">
            &larr; Session Replay
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground">Playback Console</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Recording Playback</h1>
        <p className="text-sm text-muted-foreground">
          Step-by-step editor reconstruction, telemetry timeline inspection, and integrity signals.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading session recording…</p>}>
        <ReplayScreen params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
