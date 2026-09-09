import { NextRequest, NextResponse } from "next/server";
import {
  forbiddenResponse,
  getUserFromRequest,
  requestHasCapability,
  unauthorizedResponse,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildEventWhere, CSV_HEADERS, eventToCsvRow } from "@/lib/dashboard";

export const runtime = "nodejs";

/**
 * Export email events as CSV (admin only).
 * GET /admin/export.csv?campaign=<cid>&campaign=<cid>&bots=exclude
 *
 * `campaign` may be repeated so the export matches the dashboard's programme
 * scope. Omit it to export everything.
 */
export async function GET(request: NextRequest) {
  if (!getUserFromRequest(request)) {
    return unauthorizedResponse();
  }

  // The export carries hashed IPs and full user agent strings, so it is
  // limited to administrator accounts.
  if (!requestHasCapability(request, "exportCsv")) {
    return forbiddenResponse(
      "The raw event export is limited to administrator accounts."
    );
  }

  const search = request.nextUrl.searchParams;
  const requested = search
    .getAll("campaign")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== "all");

  const campaignIds = requested.length > 0 ? requested : null;
  const excludeBots = search.get("bots") === "exclude";

  const events = await prisma.emailEvent.findMany({
    where: buildEventWhere({ campaignIds, excludeBots }),
    orderBy: { createdAt: "desc" },
  });

  const lines = [
    CSV_HEADERS.join(","),
    ...events.map((event) => eventToCsvRow(event)),
  ];

  const scope =
    requested.length === 1
      ? requested[0]
      : requested.length > 1
        ? `${requested.length}-campaigns`
        : "all";
  const filename = `email-events-${scope}${excludeBots ? "-no-bots" : ""}.csv`;

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
