import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { publishLesson } from "@/lib/services/lessons";
import { versionSchema } from "@/lib/validations/lessons";
import { assertValidInput } from "@/lib/validations/validate";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(versionSchema, await request.json());
    const lesson = await publishLesson(actor, id, input.version);
    return NextResponse.json({ success: true, data: lesson });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
