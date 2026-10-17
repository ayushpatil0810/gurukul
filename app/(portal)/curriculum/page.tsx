import { Suspense } from "react";
import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { batches, modules } from "@/db/schema";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { listCourses } from "@/lib/services/courses";
import { CourseHub } from "@/components/courses/course-hub";
import { getStudentCurriculumRoadmap } from "@/lib/services/concepts";
import { StudentConceptMapView } from "@/components/curriculum/student-concept-map";

export const metadata: Metadata = {
  title: "Course Management & Concept Map",
  description:
    "Interactive course management and concept map roadmaps. Track module progress, prerequisite dependencies, and topological learning sequences.",
};

async function CurriculumScreen({
  searchParams,
}: {
  searchParams?: Promise<{ moduleId?: string; course?: string }>;
}) {
  const query = await searchParams;
  const preferredModuleId = query?.moduleId ?? query?.course;

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

  const isTrainerOrAdmin = actor.role === "trainer" || actor.role === "admin";

  if (isTrainerOrAdmin) {
    const [coursesList, instituteBatches, instituteModules] = await Promise.all([
      listCourses(actor),
      db
        .select({ id: batches.id, name: batches.name })
        .from(batches)
        .where(eq(batches.instituteId, actor.instituteId))
        .orderBy(asc(batches.name)),
      db
        .select({ id: modules.id, name: modules.name })
        .from(modules)
        .where(eq(modules.instituteId, actor.instituteId))
        .orderBy(asc(modules.name)),
    ]);

    return (
      <CourseHub
        initialCourses={coursesList}
        batches={instituteBatches}
        availableModules={instituteModules}
      />
    );
  }

  // Student perspective: Full visual interactive concept map & topological roadmap
  const roadmapView = await getStudentCurriculumRoadmap(actor, preferredModuleId);
  return <StudentConceptMapView view={roadmapView} />;
}

export default function CurriculumPage({
  searchParams,
}: {
  searchParams?: Promise<{ moduleId?: string; course?: string }>;
}) {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex h-96 w-full items-center justify-center rounded-xl border border-border bg-card p-8">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="size-3 rounded-full bg-primary animate-ping" />
              <span>Loading curriculum roadmap and course management…</span>
            </div>
          </div>
        }
      >
        <CurriculumScreen searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

