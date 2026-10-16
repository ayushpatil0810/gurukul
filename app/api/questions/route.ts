import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { createQuestion, listQuestions } from "@/lib/services/questions";
import { createQuestionSchema } from "@/lib/validations/curriculum";
import { assertValidInput } from "@/lib/validations/validate";

export async function GET() {
  try {
    const actor = await requireActor();
    const questions = await listQuestions(actor);
    return NextResponse.json({ success: true, data: questions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const input = assertValidInput(createQuestionSchema, await request.json());
    const question = await createQuestion(actor, input);
    return NextResponse.json({ success: true, data: question }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
