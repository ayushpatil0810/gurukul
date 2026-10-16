import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const actor = await requireActor();
    return NextResponse.json({
      success: true,
      data: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        instituteId: actor.instituteId,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
