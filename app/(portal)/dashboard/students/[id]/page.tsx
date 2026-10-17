import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { readStudentDetail } from "@/lib/services/dashboard";
import { getClassroomAnalytics, type ClassroomAnalyticsSummary } from "@/lib/services/classroom-analytics";
import { StudentDetail } from "@/components/dashboard/views";

export const metadata: Metadata = {
  title: "Student mastery",
};

async function DetailScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ module?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  let denied: string | null = null;
  let view: Awaited<ReturnType<typeof readStudentDetail>> | null = null;
  let analytics: ClassroomAnalyticsSummary | null = null;
  try {
    view = await readStudentDetail(actor, id, query.module);
    analytics = await getClassroomAnalytics(actor, { studentId: id });
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) denied = error.message;
    else throw error;
  }
  if (denied) return <p className="text-sm">{denied}</p>;
  if (!view) return null;
  return <StudentDetail view={view} analytics={analytics} />;
}

export default function StudentDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ module?: string }>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm">Loading this student…</p>}>
        <DetailScreen params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
