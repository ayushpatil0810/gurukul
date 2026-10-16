import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { acceptConsent, getConsent } from "@/lib/services/assessment";
import { apiErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const actor = await requireActor();
    return NextResponse.json({ success: true, data: await getConsent(actor) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST() {
  try {
    const actor = await requireActor();
    return NextResponse.json({ success: true, data: await acceptConsent(actor) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
