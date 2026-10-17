import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { createSection } from "@/lib/services/courses";
import { createSectionSchema } from "@/lib/validations/courses";
import { assertValidInput } from "@/lib/validations/validate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const body = await request.json();
    const input = assertValidInput(createSectionSchema, body);
    const created = await createSection(actor, id, input);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
