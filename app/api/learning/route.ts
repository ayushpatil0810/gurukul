import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { listLearningModules, nextQuestion } from "@/lib/services/assessment";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    if (url.searchParams.get("list") === "modules") {
      return NextResponse.json({ success: true, data: await listLearningModules(actor) });
    }
    const moduleId = url.searchParams.get("moduleId") ?? undefined;
    return NextResponse.json({ success: true, data: await nextQuestion(actor, moduleId) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
