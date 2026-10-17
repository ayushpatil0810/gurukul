import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { getPracticeCatalog, getPracticeQuestionDetail } from "@/lib/services/practice";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const questionId = url.searchParams.get("questionId");
    const moduleId = url.searchParams.get("moduleId") ?? undefined;

    if (questionId) {
      const question = await getPracticeQuestionDetail(actor, questionId);
      return NextResponse.json({ success: true, data: question });
    }

    const catalog = await getPracticeCatalog(actor, moduleId);
    return NextResponse.json({ success: true, data: catalog });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
