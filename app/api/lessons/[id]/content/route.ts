import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { generateLessonContent } from "@/lib/services/lessons";
import { generateContentSchema } from "@/lib/validations/lessons";
import { assertValidInput } from "@/lib/validations/validate";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(generateContentSchema, await request.json());
    const lesson = await generateLessonContent(actor, id, input.version, undefined, input.outlineId);
    return NextResponse.json({ success: true, data: lesson });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
