import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { getConsent, nextQuestion } from "@/lib/services/assessment";
import { OAWorkspace } from "@/components/assessment/oa-workspace";

export const metadata: Metadata = {
  title: "Online Assessment (OA) · Fullscreen Test Environment",
  description: "Official proctored examination environment with full-screen focus and automated sandbox evaluation.",
};

async function AssessmentScreen() {
  await requireAuth();
  const actor = await getActor();
  if (actor?.role !== "student") {
    return (
      <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
        Online Assessments are available for enrolled students. Instructors can review past submissions in Session Replay and Integrity Review.
      </div>
    );
  }

  const [learning, consent] = await Promise.all([nextQuestion(actor), getConsent(actor)]);

  return (
    <OAWorkspace
      initial={learning}
      consentText={consent.consentText}
      consentAccepted={consent.accepted}
    />
  );
}

export default function AssessmentPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Initializing secure assessment environment…</p>}>
        <AssessmentScreen />
      </Suspense>
    </div>
  );
}
