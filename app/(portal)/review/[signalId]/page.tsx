import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { formatReplayTime } from "@/lib/engine/replay-playback";
import { readSignal, signalLabel, type SignalDetail } from "@/lib/services/integrity";
import { ReviewActions } from "@/components/review/review-actions";

export const metadata: Metadata = { title: "Review signal" };

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

async function SignalScreen({ params }: { params: Promise<{ signalId: string }> }) {
  const { signalId } = await params;
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  if (actor.role === "student") {
    return <p className="text-sm text-muted-foreground">Review is available to trainers and admins.</p>;
  }
  let detail: SignalDetail | null = null;
  let denied: string | null = null;
  try {
    detail = await readSignal(actor, signalId);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) {
      denied = error.message;
    } else {
      throw error;
    }
  }
  if (!detail) return <p className="text-sm text-muted-foreground">{denied ?? "Review item not found"}</p>;

  const metricRows = Object.entries(detail.metrics).filter(([, value]) => value !== null && value !== undefined);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{detail.studentName}</span>
          {detail.batchName ? <span>· {detail.batchName}</span> : null}
          <span className="rounded bg-primary/10 px-2 py-0.5 font-mono uppercase tracking-wider text-primary border border-primary/20">
            {statusLabel(detail.reviewStatus)}
          </span>
          <span className="rounded bg-secondary/80 px-2 py-0.5 font-mono uppercase tracking-wider text-muted-foreground border border-border/60">
            {detail.strength} strength
          </span>
        </div>
        <h2 className="mt-2 text-lg font-bold text-foreground">{signalLabel(detail.type)}</h2>
        <p className="mt-2 text-sm text-foreground/90">{detail.explanation}</p>
        <p className="mt-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-md border border-border/50">
          {detail.questionStatement}
        </p>
        <p className="mt-3 text-xs flex items-center gap-2">
          <Link href={detail.replayHref} className="text-primary font-medium underline-offset-4 hover:underline">
            Open Replay at {formatReplayTime(detail.tStart)} &rarr;
          </Link>
          <span className="text-muted-foreground">
            · sequences {detail.seqStart}–{detail.seqEnd} · rule v{detail.ruleVersion}
          </span>
        </p>
        {detail.supported ? null : (
          <p className="mt-3 text-xs text-amber-500/90">
            Later events no longer meet this rule. The earlier review history is kept. This is not a finding about the student.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-mono">What was measured</h2>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
          {metricRows.map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
              <dt className="text-muted-foreground font-medium">{key}</dt>
              <dd className="mt-0.5 font-mono font-semibold text-foreground">
                {typeof value === "number" ? String(Math.round(value * 1000) / 1000) : String(value)}
              </dd>
            </div>
          ))}
        </dl>
        {detail.context.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {detail.context.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {detail.limitations.length > 0 || detail.recordingNotes.length > 0 ? (
        <section className="rounded-xl border border-border/70 bg-muted/20 p-5 shadow-xs" role="status">
          <h2 className="text-sm font-semibold text-foreground">Recording limits</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {[...detail.limitations, ...detail.recordingNotes].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
        <ReviewActions signalId={detail.id} />
      </div>

      <section className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-mono">Review history</h2>
        {detail.reviews.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No disposition decision has been recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {detail.reviews.map((review) => (
              <li key={review.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">
                    {statusLabel(review.disposition)} · <span className="font-normal text-muted-foreground">{review.reviewerName}</span>
                  </p>
                  <p className="font-mono text-muted-foreground">{review.createdAt.replace("T", " ").slice(0, 19)} UTC</p>
                </div>
                {review.note ? <p className="mt-1 text-foreground/90">{review.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default function ReviewSignalPage({ params }: { params: Promise<{ signalId: string }> }) {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2 border-b border-border/70 pb-5">
        <div className="flex items-center gap-2">
          <Link href="/review" className="text-xs font-semibold uppercase tracking-wider text-primary font-mono hover:underline">
            &larr; Review Queue
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground">Signal Detail</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Review Signal Investigation</h1>
        <p className="text-sm text-muted-foreground">
          Detailed metrics, telemetry context, and human-in-the-loop review disposition actions.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading signal details…</p>}>
        <SignalScreen params={params} />
      </Suspense>
    </div>
  );
}
