import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { deleteQuestion, getQuestion, updateQuestion } from "@/lib/services/questions";
import { updateQuestionSchema } from "@/lib/validations/curriculum";
import { assertValidInput } from "@/lib/validations/validate";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const question = await getQuestion(actor, id);
    return NextResponse.json({ success: true, data: question });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(updateQuestionSchema, await request.json());
    const question = await updateQuestion(actor, id, input);
    return NextResponse.json({ success: true, data: question });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await deleteQuestion(actor, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
