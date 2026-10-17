import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { getCourseDetail, updateCourse } from "@/lib/services/courses";
import { updateCourseSchema } from "@/lib/validations/courses";
import { assertValidInput } from "@/lib/validations/validate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const data = await getCourseDetail(actor, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const body = await request.json();
    const input = assertValidInput(updateCourseSchema, body);
    const updated = await updateCourse(actor, id, input);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
