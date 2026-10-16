import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { startSession } from "@/lib/services/assessment";
import { startSessionSchema } from "@/lib/validations/assessment";
import { assertValidInput } from "@/lib/validations/validate";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const input = assertValidInput(startSessionSchema, await request.json());
    const session = await startSession(actor, input);
    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
