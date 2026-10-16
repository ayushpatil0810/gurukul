import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { deleteConcept, updateConcept } from "@/lib/services/concepts";
import { assertValidInput } from "@/lib/validations/validate";
import { updateConceptSchema } from "@/lib/validations/curriculum";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(updateConceptSchema, await request.json());
    const concept = await updateConcept(actor, id, input);
    return NextResponse.json({ success: true, data: concept });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await deleteConcept(actor, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
