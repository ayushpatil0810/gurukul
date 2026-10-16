import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/db";
import { env } from "@/lib/env";

export async function GET() {
  const dbHealth = await checkDatabaseConnection();

  const responsePayload = {
    status: dbHealth.ok ? "ok" : "degraded",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      api: { status: "healthy" },
      database: {
        status: dbHealth.ok ? "connected" : "disconnected",
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
    },
  };

  const httpStatus = dbHealth.ok ? 200 : 503;
  return NextResponse.json(responsePayload, { status: httpStatus });
}
