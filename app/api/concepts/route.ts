import { NextResponse } from "next/server";
import { assertActorRole, requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { createConcept, listConceptMap } from "@/lib/services/concepts";
import { assertValidInput } from "@/lib/validations/validate";
import { createConceptSchema } from "@/lib/validations/curriculum";

export async function GET() {
  try {
    const actor = await requireActor();
    const map = await listConceptMap(actor);
    return NextResponse.json({ success: true, data: map });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    assertActorRole(actor, ["trainer", "admin"]);
    const input = assertValidInput(createConceptSchema, await request.json());
    const concept = await createConcept(actor, input);
    return NextResponse.json({ success: true, data: concept }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
