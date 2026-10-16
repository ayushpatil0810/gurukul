import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { createModule } from "@/lib/services/concepts";
import { assertValidInput } from "@/lib/validations/validate";
import { createModuleSchema } from "@/lib/validations/curriculum";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const input = assertValidInput(createModuleSchema, await request.json());
    const created = await createModule(actor, input);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
