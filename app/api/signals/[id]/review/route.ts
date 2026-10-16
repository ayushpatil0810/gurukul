import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { recordSignalReview, type ReviewDisposition } from "@/lib/services/integrity";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const body = (await request.json()) as { disposition?: ReviewDisposition; note?: string };
    if (!body.disposition) {
      return NextResponse.json({ success: false, error: { message: "Choose a review decision" } }, { status: 400 });
    }
    const data = await recordSignalReview(actor, id, { disposition: body.disposition, note: body.note });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
