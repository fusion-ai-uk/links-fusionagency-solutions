import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticatedFromRequest, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CSV_HEADERS, eventToCsvRow } from "@/lib/dashboard";

export const runtime = "nodejs";

/**
 * Export all email events as CSV (admin only).
 * GET /admin/export.csv
 */
export async function GET(request: NextRequest) {
  if (!isAdminAuthenticatedFromRequest(request)) {
    return unauthorizedResponse();
  }

  const campaign = request.nextUrl.searchParams.get("campaign");
  const where =
    campaign && campaign !== "all" ? { campaignId: campaign } : {};

  const events = await prisma.emailEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const lines = [
    CSV_HEADERS.join(","),
    ...events.map((event) => eventToCsvRow(event)),
  ];

  const filename = campaign && campaign !== "all"
    ? `email-events-${campaign}.csv`
    : "email-events.csv";

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
