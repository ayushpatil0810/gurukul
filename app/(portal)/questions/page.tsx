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
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Question Bank</h1>
          <span className="rounded-md border border-border/80 bg-background/50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            Hidden Test Suite
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Author questions and test assertion suites. Hidden test cases remain on the server and execute in isolated Docker sandboxes during assessments.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading questions…</p>}>
        <QuestionScreen />
      </Suspense>
    </div>
  );
}
