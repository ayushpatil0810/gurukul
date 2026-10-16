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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Run checks the samples. Submit checks the hidden tests and can update mastery.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading practice…</p>}>
        <PracticeScreen />
      </Suspense>
    </div>
  );
}
