import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { readSignal } from "@/lib/services/integrity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return NextResponse.json({ success: true, data: await readSignal(actor, id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
