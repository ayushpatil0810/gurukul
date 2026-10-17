import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { getClassroomAnalytics } from "@/lib/services/classroom-analytics";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId") ?? undefined;
    const batchId = url.searchParams.get("batchId") ?? undefined;
    const lessonId = url.searchParams.get("lessonId") ?? undefined;

    const summary = await getClassroomAnalytics(actor, {
      studentId,
      batchId,
      lessonId,
    });

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
