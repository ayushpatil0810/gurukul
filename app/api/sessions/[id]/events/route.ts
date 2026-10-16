import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { AppError, apiErrorResponse } from "@/lib/errors";
import { ingestErrorMessage } from "@/lib/engine/ingest-error";
import { appendEvents, listEvents } from "@/lib/services/events";
import { eventBatchSchema } from "@/lib/validations/assessment";
import { assertValidInput } from "@/lib/validations/validate";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return NextResponse.json({ success: true, data: await listEvents(actor, id) });
  } catch (error) {
    if (error instanceof AppError) return apiErrorResponse(error);
    return NextResponse.json(
      { success: false, error: { message: ingestErrorMessage(error), code: "INTERNAL_SERVER_ERROR" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(eventBatchSchema, await request.json());
    const result = await appendEvents(actor, id, input.events);
    return NextResponse.json({ success: true, data: result.events, acked: result.acked });
  } catch (error) {
    if (error instanceof AppError) return apiErrorResponse(error);
    return NextResponse.json(
      { success: false, error: { message: ingestErrorMessage(error), code: "INTERNAL_SERVER_ERROR" } },
      { status: 500 },
    );
  }
}
