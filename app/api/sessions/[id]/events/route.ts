import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
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
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const input = assertValidInput(eventBatchSchema, await request.json());
    const data = await appendEvents(actor, id, input.events);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
