import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { publishCourse } from "@/lib/services/courses";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const published = await publishCourse(actor, id);
    return NextResponse.json({ success: true, data: published });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
