import { NextRequest, NextResponse } from "next/server";
import {
  forbiddenResponse,
  getUserFromRequest,
  requestHasCapability,
  unauthorizedResponse,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildEventWhere, CSV_HEADERS, eventToCsvRow, escapeCsvField } from "@/lib/dashboard";
import { parseEchoWindow } from "@/lib/duplication";
import { triageEvents } from "@/lib/triage";
import { baseCampaignId, getTestCampaignId } from "@/config/programmes";

export const runtime = "nodejs";

/**
 * Export email events as CSV (admin only).
 * GET /admin/export.csv?campaign=<cid>&campaign=<cid>&bots=exclude&window=10
 *
 * `campaign` may be repeated so the export matches the dashboard's programme
 * scope. Omit it to export everything. Every row carries two computed
 * columns — `phase` (test / pre-send / live) and `triage` (bot / internal /
 * echo / repeat / genuine, live rows only) — so the file is analysis-ready.
 * The export always contains every event; nothing is filtered by phase.
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
  const excludeBots = search.get("bots") === "exclude";
  const windowSeconds = parseEchoWindow(search.get("window") ?? undefined);

  // Always include each campaign's test twin: triage needs it to learn which
  // devices are testers, and the phase column keeps it distinguishable.
  const campaignIds =
    requested.length > 0
      ? Array.from(
          new Set(
            requested.flatMap((id) => [baseCampaignId(id), getTestCampaignId(id)])
          )
        )
      : null;

  const events = await prisma.emailEvent.findMany({
    where: buildEventWhere({ campaignIds, excludeBots }),
    orderBy: { createdAt: "desc" },
  });

  const triage = triageEvents(events, windowSeconds);

  const lines = [
    [...CSV_HEADERS, "phase", "triage"].join(","),
    ...events.map((event) => {
      const t = triage.byId.get(event.id);
      return [
        eventToCsvRow(event),
        escapeCsvField(t?.phase ?? ""),
        escapeCsvField(t?.reason ?? ""),
      ].join(",");
    }),
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
