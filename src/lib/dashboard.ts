import type { EmailEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNKNOWN_CAMPAIGN } from "@/lib/tracking";

export { buildEventWhere, type DashboardFilters } from "@/lib/event-filters";

/**
 * Figures on the dashboard are computed from the triaged event set in
 * src/lib/view.ts, so every number follows the same classification. What is
 * left here is the campaign discovery query and the CSV helpers.
 */

/** Every campaign ID present in the database, regardless of current filters. */
export async function getAllCampaignIdsInDb(): Promise<string[]> {
  const rows = await prisma.emailEvent.findMany({
    select: { campaignId: true },
    distinct: ["campaignId"],
  });

  // NULL and the literal 'unknown' both report as "unknown", so de-duplicate.
  const ids = new Set(rows.map((row) => row.campaignId ?? UNKNOWN_CAMPAIGN));
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

/** Escape a CSV field per RFC 4180. */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const CSV_HEADERS = [
  "id",
  "event_type",
  "campaign_id",
  "link_id",
  "destination_url",
  "ip_hash",
  "ip_country",
  "ip_region",
  "ip_city",
  "user_agent",
  "is_bot",
  "bot_reason",
  "client_kind",
  "accept_language",
  "sec_fetch_mode",
  "sec_fetch_dest",
  "sec_fetch_user",
  "sec_fetch_site",
  "created_at",
  "recipient_token",
  "message_id",
] as const;

export function eventToCsvRow(event: EmailEvent): string {
  return [
    event.id,
    event.eventType,
    event.campaignId,
    event.linkId,
    event.destinationUrl,
    event.ipHash,
    event.ipCountry,
    event.ipRegion,
    event.ipCity,
    event.userAgent,
    event.isBot,
    event.botReason,
    event.clientKind,
    event.acceptLanguage,
    event.secFetchMode,
    event.secFetchDest,
    event.secFetchUser,
    event.secFetchSite,
    event.createdAt,
    event.recipientToken,
    event.messageId,
  ]
    .map(escapeCsvField)
    .join(",");
}
