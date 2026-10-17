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
    <div className="px-4 md:px-6 py-6 pb-16 space-y-6">
      <header className="border-b border-border/60 pb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
          <span className="size-1.5 rounded-full bg-primary" />
          Interactive Assessment Lab
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Coding Practice & Evaluation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Run tests sample assertions inside isolated Docker containers. Submit executes hidden test verification to update BKT mastery.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading practice workspace…</p>}>
        <PracticeScreen />
      </Suspense>
    </div>
  );
}
