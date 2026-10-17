import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import {
  readStudentDashboardFullView,
  readTrainerDashboard,
  type StudentDashboardFullView,
} from "@/lib/services/dashboard";
import { getClassroomAnalytics, type ClassroomAnalyticsSummary } from "@/lib/services/classroom-analytics";
import { TrainerLearning } from "@/components/dashboard/views";
import { PortalDashboardView } from "@/components/portal/dashboard-view";
import { StudentDashboardView } from "@/components/dashboard/student-dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function DashboardScreen({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; module?: string }>;
}) {
  const query = await searchParams;
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  let denied: string | null = null;
  let student: StudentDashboardFullView | null = null;
  let trainer: Awaited<ReturnType<typeof readTrainerDashboard>> | null = null;
  let analytics: ClassroomAnalyticsSummary | null = null;

  try {
    if (actor.role === "student") {
      student = await readStudentDashboardFullView(actor, query.module);
      analytics = await getClassroomAnalytics(actor);
    } else {
      trainer = await readTrainerDashboard(actor, { batchId: query.batch, moduleId: query.module });
      analytics = await getClassroomAnalytics(actor, { batchId: query.batch });
    }
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) denied = error.message;
    else throw error;
  }

  if (denied) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{denied}</p>
      </div>
    );
  }

  if (actor.role === "student" && student) {
    return (
      <div className="px-4 md:px-6 pt-2">
        <StudentDashboardView view={student} analytics={analytics} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Instructor / Admin Dashboard View */}
      <PortalDashboardView userName={actor.name} role={actor.role} />

      <div className="px-4 md:px-6 pb-12">
        {trainer ? (
          <TrainerLearning
            batchId={query.batch}
            moduleId={query.module}
            view={trainer}
            analytics={analytics}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; module?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground animate-pulse">Loading dashboard...</div>}>
      <DashboardScreen searchParams={searchParams} />
    </Suspense>
  );
}
