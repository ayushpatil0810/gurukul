import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { getCourseLearnData } from "@/lib/services/learn-module";
import { LearnModuleView } from "@/components/learn/learn-module-view";

export const metadata: Metadata = {
  title: "Learn Module · Course Concepts & Quizzes",
  description: "Comprehensive course concept syllabus, interactive lessons, and mastery quizzes.",
};

async function LearnScreen() {
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  if (actor.role !== "student") {
    return (
      <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
        The Learn module is designed for enrolled students. Instructors can author course content in the Lesson Studio.
      </div>
    );
  }

  const learnData = await getCourseLearnData(actor);
  return <LearnModuleView data={learnData} />;
}

export default function LearnPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <Suspense
        fallback={
          <div className="space-y-4 animate-pulse">
            <div className="h-40 rounded-2xl bg-muted/60" />
            <div className="h-64 rounded-xl bg-muted/40" />
          </div>
        }
      >
        <LearnScreen />
      </Suspense>
    </div>
  );
}
