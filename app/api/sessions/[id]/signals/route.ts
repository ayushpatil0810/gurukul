import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { listReviewQueue, persistSessionSignals } from "@/lib/services/integrity";
import { readReplay } from "@/lib/services/replay";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await readReplay(actor, id);
    return NextResponse.json({ success: true, data: await listReviewQueue(actor, { sessionId: id }) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await readReplay(actor, id);
    const result = await persistSessionSignals(id);
    const signals = await listReviewQueue(actor, { sessionId: id });
    return NextResponse.json({ success: true, data: { ...result, signals } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
