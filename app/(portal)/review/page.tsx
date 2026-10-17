import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { listReviewBatches, listReviewQueue } from "@/lib/services/integrity";
import { ReviewHub } from "@/components/review/review-hub";

export const metadata: Metadata = {
  title: "Integrity Review & Audit Hub",
  description: "Investigate student keystroke anomalies, code paste insertions, and manage academic integrity verdicts.",
};

async function ReviewScreen({
  searchParams,
}: {
  searchParams?: Promise<{ batchId?: string; type?: string; status?: string }>;
}) {
  const query = await searchParams;
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
        Integrity Review is available to trainers and administrators.
      </div>
    );
  }

  const [items, batches] = await Promise.all([
    listReviewQueue(actor, {
      batchId: query?.batchId || undefined,
      type: query?.type || undefined,
      status: query?.status || undefined,
    }),
    listReviewBatches(actor),
  ]);

  return <ReviewHub initialItems={items} batches={batches} />;
}

export default function ReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ batchId?: string; type?: string; status?: string }>;
}) {
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
        <ReviewScreen searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

