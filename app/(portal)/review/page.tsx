import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { formatReplayTime } from "@/lib/engine/replay-playback";
import { listReviewBatches, listReviewQueue, signalLabel } from "@/lib/services/integrity";

export const metadata: Metadata = { title: "Review" };

const TYPES = [
  { value: "", label: "All patterns" },
  { value: "large_paste", label: "Large paste" },
  { value: "faster_than_rhythm", label: "Unusual typing burst" },
  { value: "no_write_run_fix", label: "No write-run-fix iteration" },
  { value: "evenly_typed", label: "Unusually uniform typing" },
];

const STATUSES = [
  { value: "", label: "Any status" },
  { value: "pending", label: "Pending" },
  { value: "dismissed", label: "Dismissed" },
  { value: "needs_viva", label: "Needs viva" },
  { value: "escalated", label: "Escalated" },
];

async function ReviewQueue({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string; type?: string; status?: string }>;
}) {
  const query = await searchParams;
  await requireAuth();
  const actor = await getActor();
  if (!actor?.instituteId) {
    return <p className="text-sm text-muted-foreground">Your account is not assigned to an institute yet.</p>;
  }
  if (actor.role === "student") {
    return <p className="text-sm text-muted-foreground">Review is available to trainers and admins.</p>;
  }

  const [items, batches] = await Promise.all([
    listReviewQueue(actor, {
      batchId: query.batchId || undefined,
      type: query.type || undefined,
      status: query.status || undefined,
    }),
    listReviewBatches(actor),
  ]);

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter review signals">
        <label className="text-sm">
          Batch
          <select
            name="batchId"
            defaultValue={query.batchId ?? ""}
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="">All batches</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Pattern
          <select
            name="type"
            defaultValue={query.type ?? ""}
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
          >
            {TYPES.map((type) => (
              <option key={type.value || "all"} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Status
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
          >
            {STATUSES.map((status) => (
              <option key={status.value || "any"} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-border px-3 py-1 text-sm">
          Apply
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No review signals match these filters.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/review/${item.id}`} className="block px-4 py-3 hover:bg-muted">
                <span className="font-medium">{signalLabel(item.type)}</span>
                <span className="ml-2 text-sm text-muted-foreground">{item.strength}</span>
                <span className="ml-2 text-sm text-muted-foreground">{item.reviewStatus.replaceAll("_", " ")}</span>
                <span className="mt-1 block text-sm">
                  {item.studentName}
                  {item.batchName ? ` · ${item.batchName}` : ""} · {formatReplayTime(item.tStart)}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{item.explanation}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string; type?: string; status?: string }>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Patterns from recorded sessions, sorted by strength. Each one needs a person to interpret it. Nothing here
        changes a grade, a mastery value, or a student&apos;s access.
      </p>
      <p className="mt-3 mb-6 text-sm text-muted-foreground">
        A second device is not visible. Fast typing, assistive technology, and ordinary pasted notes can look like
        these patterns. Missing telemetry is a recording limit, not a finding about the student. There is no combined
        score.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the queue…</p>}>
        <ReviewQueue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
