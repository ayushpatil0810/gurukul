import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { getAdaptiveRecommendation } from "@/lib/services/adaptive-loop";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const moduleId = url.searchParams.get("moduleId") ?? undefined;
    const studentId = url.searchParams.get("studentId") ?? undefined;

    const recommendation = await getAdaptiveRecommendation(actor, {
      moduleId,
      studentId,
    });

    return NextResponse.json({ success: true, data: recommendation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
