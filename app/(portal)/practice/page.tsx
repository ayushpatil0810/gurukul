import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { getConsent, nextQuestion } from "@/lib/services/assessment";
import { PracticeWorkspace } from "@/components/practice/workspace";

export const metadata: Metadata = {
  title: "Practice",
};

async function PracticeScreen() {
  await requireAuth();
  const actor = await getActor();
  if (actor?.role !== "student") {
    return <p className="text-sm text-muted-foreground">Practice is available to students.</p>;
  }
  const [learning, consent] = await Promise.all([nextQuestion(actor), getConsent(actor)]);
  return (
    <PracticeWorkspace
      initial={learning}
      consentText={consent.consentText}
      consentAccepted={consent.accepted}
    />
  );
}

export default function PracticePage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Practice Lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ungraded interactive coding laboratory. Run samples, experiment with code, and prepare for assessments.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ready for the official test?</span>
          <a
            href="/assessment"
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            Go to Online Assessment (OA) &rarr;
          </a>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading practice…</p>}>
        <PracticeScreen />
      </Suspense>
    </div>
  );
}
