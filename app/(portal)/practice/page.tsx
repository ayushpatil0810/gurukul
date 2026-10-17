import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { getPracticeCatalog, getPracticeQuestionDetail } from "@/lib/services/practice";
import { PracticeContainer } from "@/components/practice/practice-container";

export const metadata: Metadata = {
  title: "Practice Lab · Module Programming Challenges",
  description:
    "Interactive ungraded LeetCode-style programming laboratory. Solve coding challenges across your enrolled modules with instant sandbox evaluation.",
};

async function PracticeScreen({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; questionId?: string; module?: string; moduleId?: string }>;
}) {
  const query = await searchParams;
  const preferredModuleId = query?.module ?? query?.moduleId;
  const preferredQuestionId = query?.q ?? query?.questionId;

  await requireAuth();
  const actor = await getActor();
  if (!actor || actor.role !== "student") {
    return (
      <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
        The Practice Lab is designed for enrolled students. Instructors can author questions in the Question Bank and Lesson Studio.
      </div>
    );
  }

  const catalog = await getPracticeCatalog(actor, preferredModuleId);

  let initialQuestion = null;
  if (preferredQuestionId) {
    try {
      initialQuestion = await getPracticeQuestionDetail(actor, preferredQuestionId);
    } catch {
      initialQuestion = null;
    }
  }

  return (
    <PracticeContainer
      initialCatalog={catalog}
      initialQuestion={initialQuestion}
    />
  );
}

export default function PracticePage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; questionId?: string; module?: string; moduleId?: string }>;
}) {
  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <Suspense
        fallback={
          <div className="space-y-4 animate-pulse">
            <div className="h-28 rounded-2xl bg-muted/60" />
            <div className="h-80 rounded-xl bg-muted/40" />
          </div>
        }
      >
        <PracticeScreen searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
