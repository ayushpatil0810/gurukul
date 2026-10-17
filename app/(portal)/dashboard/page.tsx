import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { readStudentDashboard, readTrainerDashboard } from "@/lib/services/dashboard";
import { getClassroomAnalytics, type ClassroomAnalyticsSummary } from "@/lib/services/classroom-analytics";
import { StudentLearning, TrainerLearning } from "@/components/dashboard/views";
import { PortalDashboardView } from "@/components/portal/dashboard-view";

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
  let student: Awaited<ReturnType<typeof readStudentDashboard>> | null = null;
  let trainer: Awaited<ReturnType<typeof readTrainerDashboard>> | null = null;
  let analytics: ClassroomAnalyticsSummary | null = null;

  try {
    if (actor.role === "student") {
      student = await readStudentDashboard(actor, query.module);
      analytics = await getClassroomAnalytics(actor);
    } else {
      trainer = await readTrainerDashboard(actor, { batchId: query.batch, moduleId: query.module });
      analytics = await getClassroomAnalytics(actor, { batchId: query.batch });
    }
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) denied = error.message;
    else throw error;
  }

  return (
    <div className="space-y-8">
      {/* New Template Executive Dashboard View */}
      <PortalDashboardView userName={actor.name} role={actor.role} />

      {/* Role-Specific Learning & Mastery Records */}
      <div className="px-4 md:px-6 pb-12">
        {denied ? (
          <p className="text-sm text-destructive">{denied}</p>
        ) : student ? (
          <StudentLearning view={student} analytics={analytics} />
        ) : trainer ? (
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
