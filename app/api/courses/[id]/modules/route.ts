import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { addModuleToCourse, removeModuleFromCourse } from "@/lib/services/courses";
import { addCourseModuleSchema } from "@/lib/validations/courses";
import { assertValidInput } from "@/lib/validations/validate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const body = await request.json();
    const input = assertValidInput(addCourseModuleSchema, body);
    const result = await addModuleToCourse(actor, id, input);
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
    const moduleId = searchParams.get("moduleId");
    if (!moduleId) {
      return NextResponse.json({ success: false, error: { message: "moduleId query parameter is required" } }, { status: 400 });
    }
    const result = await removeModuleFromCourse(actor, id, moduleId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
