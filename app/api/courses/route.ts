import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { createCourse, listCourses } from "@/lib/services/courses";
import { createCourseSchema } from "@/lib/validations/courses";
import { assertValidInput } from "@/lib/validations/validate";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batch") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("q") ?? undefined;

    const data = await listCourses(actor, { batchId, status, search });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = await request.json();
    const input = assertValidInput(createCourseSchema, body);
    const created = await createCourse(actor, input);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
