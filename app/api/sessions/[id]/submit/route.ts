import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { submitSession } from "@/lib/services/assessment";
import { codeSubmissionSchema } from "@/lib/validations/assessment";
import { assertValidInput } from "@/lib/validations/validate";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(codeSubmissionSchema, await request.json());
    const result = await submitSession(actor, id, input);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
