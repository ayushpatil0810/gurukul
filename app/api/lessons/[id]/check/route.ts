import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { assertValidInput } from "@/lib/validations/validate";
import { checkLessonQuestion } from "@/lib/services/lessons";

const checkQuestionSchema = z.object({
  questionId: z.string().trim().min(1).max(100),
  selectedOption: z.string().trim().min(1).max(1000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const body = assertValidInput(checkQuestionSchema, await request.json());

    const result = await checkLessonQuestion(actor, id, body);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
