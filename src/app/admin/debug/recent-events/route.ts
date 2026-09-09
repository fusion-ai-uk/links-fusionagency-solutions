import { NextRequest, NextResponse } from "next/server";
import {
  forbiddenResponse,
  getUserFromRequest,
  requestHasCapability,
  unauthorizedResponse,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Temporary debug endpoint (admin only).
 * GET /admin/debug/recent-events
 *
 * Returns the latest 20 EmailEvent rows so we can confirm whether opens/clicks
 * are actually being written to the database.
 */
export async function GET(request: NextRequest) {
  if (!getUserFromRequest(request)) {
    return unauthorizedResponse();
  }

  if (!requestHasCapability(request, "viewDebugEndpoint")) {
    return forbiddenResponse(
      "The debug endpoint is limited to administrator accounts."
    );
  }

  try {
    const [totalEvents, totalOpens, totalClicks, recent] = await Promise.all([
      prisma.emailEvent.count(),
      prisma.emailEvent.count({ where: { eventType: "open" } }),
      prisma.emailEvent.count({ where: { eventType: "click" } }),
      prisma.emailEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          eventType: true,
          campaignId: true,
          linkId: true,
          destinationUrl: true,
          ipCountry: true,
          ipRegion: true,
          ipCity: true,
          isBot: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        database: "connected",
        totals: { all: totalEvents, opens: totalOpens, clicks: totalClicks },
        recent,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[debug/recent-events] DB query failed:", error);
    return NextResponse.json(
      {
        database: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
