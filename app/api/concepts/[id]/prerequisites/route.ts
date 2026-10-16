import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { addPrerequisite } from "@/lib/services/concepts";
import { assertValidInput } from "@/lib/validations/validate";
import { prerequisiteSchema } from "@/lib/validations/curriculum";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(prerequisiteSchema, await request.json());
    const edge = await addPrerequisite(actor, id, input.requiresId);
    return NextResponse.json({ success: true, data: edge }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
