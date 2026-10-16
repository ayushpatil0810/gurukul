import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { readReplay } from "@/lib/services/replay";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return NextResponse.json({ success: true, data: await readReplay(actor, id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
