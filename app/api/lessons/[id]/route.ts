import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { readLessonForAuthor, saveOutline, saveSceneEdits } from "@/lib/services/lessons";
import { saveOutlineSchema, saveScenesSchema } from "@/lib/validations/lessons";
import { assertValidInput } from "@/lib/validations/validate";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return NextResponse.json({ success: true, data: await readLessonForAuthor(actor, id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const body = await request.json();
    if (body && typeof body === "object" && "outlines" in body) {
      const input = assertValidInput(saveOutlineSchema, body);
      return NextResponse.json({
        success: true,
        data: await saveOutline(actor, id, input.version, input.outlines, input.codeLanguage),
      });
    }
    const input = assertValidInput(saveScenesSchema, body);
    return NextResponse.json({ success: true, data: await saveSceneEdits(actor, id, input.version, input.scenes) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
