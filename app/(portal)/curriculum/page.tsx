import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { getStudentCurriculumRoadmap } from "@/lib/services/concepts";
import { StudentConceptMapView } from "@/components/curriculum/student-concept-map";

export const metadata: Metadata = {
  title: "Concept Map & Course Roadmaps",
  description:
    "Interactive concept map and roadmap flow for enrolled courses. Track module progress, prerequisite dependencies, and topological learning sequences.",
};

async function ConceptMapScreen({ preferredModuleId }: { preferredModuleId?: string }) {
  await requireAuth();
  const actor = await getActor();
  if (!actor?.instituteId) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Your account is not assigned to an institute yet.
        </p>
      </div>
    );
  }

  const roadmapView = await getStudentCurriculumRoadmap(actor, preferredModuleId);
  return <StudentConceptMapView view={roadmapView} />;
}

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ moduleId?: string; course?: string }>;
}) {
  const query = await searchParams;
  const preferredModuleId = query.moduleId ?? query.course;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex h-96 w-full items-center justify-center rounded-xl border border-border bg-card p-8">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="size-3 rounded-full bg-primary animate-ping" />
              <span>Loading curriculum roadmap and course telemetry…</span>
            </div>
          </div>
        }
      >
        <ConceptMapScreen preferredModuleId={preferredModuleId} />
      </Suspense>
    </div>
  );
}
