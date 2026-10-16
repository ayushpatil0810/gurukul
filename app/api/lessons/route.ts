import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { createLesson, listLessons } from "@/lib/services/lessons";
import { createLessonSchema } from "@/lib/validations/lessons";
import { assertValidInput } from "@/lib/validations/validate";

export async function GET() {
  try {
    const actor = await requireActor();
    return NextResponse.json({ success: true, data: await listLessons(actor) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const input = assertValidInput(createLessonSchema, await request.json());
    const lesson = await createLesson(actor, input);
    return NextResponse.json({ success: true, data: lesson }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
