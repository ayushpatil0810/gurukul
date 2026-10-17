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
      <section className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">
          {detail.studentName}
          {detail.batchName ? ` · ${detail.batchName}` : ""} · {statusLabel(detail.reviewStatus)} · {detail.strength}{" "}
          strength
        </p>
        <h2 className="mt-1 text-lg font-semibold">{signalLabel(detail.type)}</h2>
        <p className="mt-2 text-sm">{detail.explanation}</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail.questionStatement}</p>
        <p className="mt-3 text-sm">
          <Link href={detail.replayHref} className="underline-offset-4 hover:underline">
            Open the replay at {formatReplayTime(detail.tStart)}
          </Link>
          <span className="text-muted-foreground">
            {" "}
            · sequences {detail.seqStart}–{detail.seqEnd} · rule {detail.ruleVersion}
          </span>
        </p>
        {detail.supported ? null : (
          <p className="mt-3 text-sm">
            Later events no longer meet this rule. The earlier review history is kept. This is not a finding about the
            student.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-medium">What was measured</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {metricRows.map(([key, value]) => (
            <div key={key}>
              <dt className="text-muted-foreground">{key}</dt>
              <dd>{typeof value === "number" ? String(Math.round(value * 1000) / 1000) : String(value)}</dd>
            </div>
          ))}
        </dl>
        {detail.context.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            {detail.context.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {detail.limitations.length > 0 || detail.recordingNotes.length > 0 ? (
        <section className="rounded-lg border border-border p-4" role="status">
          <h2 className="font-medium">Recording limits</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {[...detail.limitations, ...detail.recordingNotes].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <ReviewActions signalId={detail.id} />

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-medium">Review history</h2>
        {detail.reviews.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No decision has been recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {detail.reviews.map((review) => (
              <li key={review.id} className="text-sm">
                <p className="font-medium">
                  {statusLabel(review.disposition)} · {review.reviewerName}
                </p>
                <p className="text-muted-foreground">{review.createdAt.replace("T", " ").slice(0, 19)} UTC</p>
                {review.note ? <p className="mt-1">{review.note}</p> : null}
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="mb-4 text-sm">
        <Link href="/review" className="text-muted-foreground underline-offset-4 hover:underline">
          Review queue
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Review signal</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the signal…</p>}>
        <SignalScreen params={params} />
      </Suspense>
    </div>
  );
}
