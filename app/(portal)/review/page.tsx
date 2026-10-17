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
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-xs">
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter review signals">
          <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1.5">
            <span>Batch</span>
            <select
              name="batchId"
              defaultValue={query.batchId ?? ""}
              aria-label="Filter by batch"
              className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1.5">
            <span>Pattern</span>
            <select
              name="type"
              defaultValue={query.type ?? ""}
              aria-label="Filter by pattern"
              className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {TYPES.map((type) => (
                <option key={type.value || "all"} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1.5">
            <span>Status</span>
            <select
              name="status"
              defaultValue={query.status ?? ""}
              aria-label="Filter by status"
              className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STATUSES.map((status) => (
                <option key={status.value || "any"} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-border/80 bg-secondary px-3.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Apply Filters
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
          <p className="text-sm text-muted-foreground">No review signals match the selected filters.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-card/60 shadow-xs">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/review/${item.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{signalLabel(item.type)}</span>
                    <span className="rounded bg-secondary/80 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground border border-border/60">
                      {item.strength}
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-primary border border-primary/20">
                      {item.reviewStatus.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.studentName}</span>
                    {item.batchName ? ` · ${item.batchName}` : ""} · {formatReplayTime(item.tStart)}
                  </p>
                  <p className="text-xs text-muted-foreground/90">{item.explanation}</p>
                </div>
                <div className="shrink-0 text-xs font-medium text-primary flex items-center gap-1">
                  Review &rarr;
                </div>
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-1 border-b border-border/70 pb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">
            Integrity Diagnostics
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground">Review Queue</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Review Queue</h1>
        <p className="text-sm text-muted-foreground">
          Telemetry patterns from recorded coding sessions, sorted by strength. Each signal requires human interpretation.
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Note: Fast typing, assistive technology, and pasted notes can create false signals. Telemetry limits do not represent disciplinary findings.
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the review queue…</p>}>
        <ReviewQueue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
