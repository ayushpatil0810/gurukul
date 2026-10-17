import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { assertValidInput } from "@/lib/validations/validate";
import { classroomTelemetryBatchSchema } from "@/lib/validations/classroom-telemetry";
import {
  listClassroomEventsForStudent,
  recordClassroomTelemetry,
} from "@/lib/services/classroom-telemetry";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id: lessonId } = await context.params;
    const body = await request.json();

    // Ensure lessonId in payload matches route param
    const input = assertValidInput(classroomTelemetryBatchSchema, {
      ...body,
      lessonId: body.lessonId || lessonId,
    });

    const result = await recordClassroomTelemetry(
      actor,
      lessonId,
      input.events,
      input.sessionId,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id: lessonId } = await context.params;
    const events = await listClassroomEventsForStudent(actor, lessonId);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
