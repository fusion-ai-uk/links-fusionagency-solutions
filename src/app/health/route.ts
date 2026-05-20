import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Health check for uptime monitoring and Vercel deployment verification.
 */
export async function GET() {
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (error) {
    console.error("[health] Database check failed:", error);
  }

  const body = {
    status: dbOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    database: dbOk ? "connected" : "unavailable",
  };

  return Response.json(body, {
    status: dbOk ? 200 : 503,
  });
}
