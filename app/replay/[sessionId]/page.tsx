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
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-medium">Explain your code</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These answers are stored separately from the hidden-test score and from review signals.
          </p>
          <div className="mt-4 space-y-6">
            {explanations.map((set) => (
              <article key={set.id} className="space-y-3 text-sm">
                <p>
                  Submission {set.attemptId} · {set.language} · {set.status}
                </p>
                {set.note ? <p>{set.note}</p> : null}
                <pre className="overflow-auto rounded-md border border-border p-3">{set.codeSnapshot}</pre>
                <ol className="space-y-3">
                  {set.questions.map((question) => (
                    <li key={question.id}>
                      <p className="font-medium">{question.prompt}</p>
                      <p className="text-muted-foreground">
                        Lines {question.startLine}–{question.endLine}: {question.quote}
                      </p>
                      <p>Answer: {question.answer ?? "Not answered yet"}</p>
                      {set.status === "answered" ? (
                        <p>
                          {question.verdictLabel ?? "Not enough evidence"}
                          {question.reviewStatus === "needs_review" ? " · Needs review" : ""}
                          {question.method ? ` · ${question.method}` : ""}
                          {question.confidence !== null ? ` · confidence ${question.confidence}` : ""}
                        </p>
                      ) : null}
                      {question.evidence.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                      {question.missed.map((item) => (
                        <p key={item}>{item}</p>
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
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-medium">Review signals in this recording</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These are patterns for a person to interpret. They do not change a grade or a mastery value.
          </p>
          <ul className="mt-3 space-y-2">
            {signals.map((signal) => (
              <li key={signal.id}>
                <Link href={signal.replayHref} className="text-sm underline-offset-4 hover:underline">
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="mb-4 text-sm">
        <Link href="/replay" className="text-muted-foreground underline-offset-4 hover:underline">
          All recordings
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Replay</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the recording…</p>}>
        <ReplayScreen params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
