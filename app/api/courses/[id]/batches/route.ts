import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { assignCourseBatches } from "@/lib/services/courses";
import { assignBatchesSchema } from "@/lib/validations/courses";
import { assertValidInput } from "@/lib/validations/validate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const body = await request.json();
    const input = assertValidInput(assignBatchesSchema, body);
    const deadline = input.deadline ? new Date(input.deadline) : null;
    const result = await assignCourseBatches(actor, id, input.batchIds, deadline);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
