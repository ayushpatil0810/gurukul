import { Suspense } from "react";
import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { batches, modules } from "@/db/schema";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { listCourses, getCourseDetail } from "@/lib/services/courses";
import { CourseHub } from "@/components/courses/course-hub";
import { StudentSyllabusView } from "@/components/courses/student-syllabus-view";

export const metadata: Metadata = {
  title: "Course Management",
};

async function CurriculumScreen() {
  await requireAuth();
  const actor = await getActor();
  if (!actor?.instituteId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account is not assigned to an institute yet.
      </p>
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

  // Student perspective
  const studentCourses = await listCourses(actor, { status: "published" });
  let initialDetail = null;
  if (studentCourses.length > 0 && studentCourses[0]) {
    try {
      initialDetail = await getCourseDetail(actor, studentCourses[0].id);
    } catch {
      // Fallback
    }
  }

  return <StudentSyllabusView courses={studentCourses} initialDetail={initialDetail} />;
}

export default function CurriculumPage() {
  return (
    <div className="px-4 md:px-6 py-6 pb-16">
      <Suspense
        fallback={
          <div className="p-8 text-sm text-muted-foreground animate-pulse">
            Loading course management & curriculum tracks...
          </div>
        }
      >
        <CurriculumScreen />
      </Suspense>
    </div>
  );
}
