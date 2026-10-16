import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { readStudentForActor } from "@/lib/services/students";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const student = await readStudentForActor(actor, id);
    return NextResponse.json({ success: true, data: student });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
