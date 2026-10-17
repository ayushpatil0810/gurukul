import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { deleteSection, updateSection } from "@/lib/services/courses";
import { updateSectionSchema } from "@/lib/validations/courses";
import { assertValidInput } from "@/lib/validations/validate";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const body = await request.json();
    const input = assertValidInput(updateSectionSchema, body);
    const updated = await updateSection(actor, id, input);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const result = await deleteSection(actor, id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
