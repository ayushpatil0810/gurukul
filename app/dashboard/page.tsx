import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { readStudentDashboard, readTrainerDashboard } from "@/lib/services/dashboard";
import { getClassroomAnalytics, type ClassroomAnalyticsSummary } from "@/lib/services/classroom-analytics";
import { StudentLearning, TrainerLearning } from "@/components/dashboard/views";

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
  if (denied) return <p className="text-sm">{denied}</p>;
  if (student) return <StudentLearning view={student} analytics={analytics} />;
  if (trainer) return <TrainerLearning batchId={query.batch} moduleId={query.module} view={trainer} analytics={analytics} />;
  return null;
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; module?: string }>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm">Loading the dashboard…</p>}>
        <DashboardScreen searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
