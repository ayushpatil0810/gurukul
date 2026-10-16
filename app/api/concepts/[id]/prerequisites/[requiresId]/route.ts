import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { removePrerequisite } from "@/lib/services/concepts";

type RouteContext = { params: Promise<{ id: string; requiresId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id, requiresId } = await context.params;
    await removePrerequisite(actor, id, requiresId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
