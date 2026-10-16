import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { listConceptMap } from "@/lib/services/concepts";
import { listQuestions } from "@/lib/services/questions";
import { QuestionManager } from "@/components/questions/question-manager";

export const metadata: Metadata = {
  title: "Questions",
};

async function QuestionScreen() {
  await requireAuth();
  const actor = await getActor();
  if (!actor?.instituteId) {
    return <p className="text-sm text-muted-foreground">Your account is not assigned to an institute yet.</p>;
  }
  if (actor.role === "student") {
    return <p className="text-sm text-muted-foreground">The question bank is available to trainers and admins.</p>;
  }

  const [questions, map] = await Promise.all([listQuestions(actor), listConceptMap(actor)]);
  return <QuestionManager questions={questions} concepts={map.concepts} />;
}

export default function QuestionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Question bank</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Hidden tests stay on the server. This list shows how many exist, not their inputs or expected outputs.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading questions…</p>}>
        <QuestionScreen />
      </Suspense>
    </div>
  );
}
