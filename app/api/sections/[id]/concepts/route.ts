import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { addConceptToSection, removeConceptFromSection } from "@/lib/services/courses";
import { attachConceptSchema } from "@/lib/validations/courses";
import { assertValidInput } from "@/lib/validations/validate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const body = await request.json();
    const input = assertValidInput(attachConceptSchema, body);
    const result = await addConceptToSection(actor, id, input.conceptId, input.orderIndex);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const conceptId = searchParams.get("conceptId");
    if (!conceptId) {
      return NextResponse.json(
        { success: false, error: { message: "conceptId query parameter is required" } },
        { status: 400 },
      );
    }
    const result = await removeConceptFromSection(actor, id, conceptId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
