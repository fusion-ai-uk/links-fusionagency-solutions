import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Columns added by later migrations. If any is missing the deploy went out
 * without its migration, and every insert will be failing.
 */
const REQUIRED_COLUMNS = ["client_kind", "bot_reason", "sec_fetch_mode"];

/**
 * Health check for uptime monitoring and Vercel deployment verification.
 * Reports database reachability and whether the schema is current.
 */
export async function GET() {
  let dbOk = false;
  let schemaOk: boolean | null = null;
  let missing: string[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;

    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'email_events'
    `;
    const present = new Set(rows.map((r) => r.column_name));
    missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
    schemaOk = missing.length === 0;
  } catch (error) {
    console.error("[health] Database check failed:", error);
  }

  const healthy = dbOk && schemaOk === true;

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database: dbOk ? "connected" : "unavailable",
      schema:
        schemaOk === null
          ? "unknown"
          : schemaOk
            ? "current"
            : `outdated — missing ${missing.join(", ")}`,
    },
    { status: healthy ? 200 : 503 }
  );
}
