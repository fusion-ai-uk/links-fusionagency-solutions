import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface DashboardStats {
  totalOpens: number;
  totalClicks: number;
  approximateUniqueOpens: number;
  approximateUniqueClicks: number;
  clicksByLinkId: { linkId: string; count: number }[];
  eventsByCampaign: { campaignId: string; opens: number; clicks: number }[];
  recentEvents: {
    id: string;
    eventType: string;
    campaignId: string | null;
    linkId: string | null;
    destinationUrl: string | null;
    ipCountry: string | null;
    isBot: boolean;
    createdAt: Date;
  }[];
  campaigns: string[];
}

/**
 * Best-effort unique count using distinct campaign_id + event_type + ip_hash + user_agent.
 * Labelled approximate in the dashboard — does not identify individual recipients.
 */
async function countApproximateUnique(
  eventType: "open" | "click",
  campaignFilter?: string | null
): Promise<number> {
  const campaignClause =
    campaignFilter && campaignFilter !== "all"
      ? Prisma.sql`AND campaign_id = ${campaignFilter}`
      : Prisma.empty;

  const result = await prisma.$queryRaw<[{ count: bigint }]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT DISTINCT
          COALESCE(campaign_id, 'unknown') AS campaign_id,
          event_type,
          COALESCE(ip_hash, '') AS ip_hash,
          COALESCE(user_agent, '') AS user_agent
        FROM email_events
        WHERE event_type = ${eventType}
        ${campaignClause}
      ) AS unique_combos
    `
  );

  return Number(result[0]?.count ?? 0);
}

export async function getDashboardStats(
  campaignFilter?: string | null
): Promise<DashboardStats> {
  const where =
    campaignFilter && campaignFilter !== "all"
      ? { campaignId: campaignFilter }
      : {};

  const [
    totalOpens,
    totalClicks,
    approximateUniqueOpens,
    approximateUniqueClicks,
    clicksByLinkRaw,
    opensByCampaign,
    clicksByCampaign,
    recentEvents,
    campaignsRaw,
  ] = await Promise.all([
    prisma.emailEvent.count({ where: { ...where, eventType: "open" } }),
    prisma.emailEvent.count({ where: { ...where, eventType: "click" } }),
    countApproximateUnique("open", campaignFilter),
    countApproximateUnique("click", campaignFilter),
    prisma.emailEvent.groupBy({
      by: ["linkId"],
      where: {
        ...where,
        eventType: "click",
        linkId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.emailEvent.groupBy({
      by: ["campaignId"],
      where: { ...where, eventType: "open", campaignId: { not: null } },
      _count: { id: true },
    }),
    prisma.emailEvent.groupBy({
      by: ["campaignId"],
      where: { ...where, eventType: "click", campaignId: { not: null } },
      _count: { id: true },
    }),
    prisma.emailEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        eventType: true,
        campaignId: true,
        linkId: true,
        destinationUrl: true,
        ipCountry: true,
        isBot: true,
        createdAt: true,
      },
    }),
    prisma.emailEvent.findMany({
      where: { campaignId: { not: null } },
      select: { campaignId: true },
      distinct: ["campaignId"],
      orderBy: { campaignId: "asc" },
    }),
  ]);

  const campaignMap = new Map<string, { opens: number; clicks: number }>();

  for (const row of opensByCampaign) {
    if (!row.campaignId) continue;
    campaignMap.set(row.campaignId, {
      opens: row._count.id,
      clicks: campaignMap.get(row.campaignId)?.clicks ?? 0,
    });
  }

  for (const row of clicksByCampaign) {
    if (!row.campaignId) continue;
    const existing = campaignMap.get(row.campaignId);
    campaignMap.set(row.campaignId, {
      opens: existing?.opens ?? 0,
      clicks: row._count.id,
    });
  }

  const eventsByCampaign = Array.from(campaignMap.entries())
    .map(([campaignId, counts]) => ({ campaignId, ...counts }))
    .sort((a, b) => b.opens + b.clicks - (a.opens + a.clicks));

  return {
    totalOpens,
    totalClicks,
    approximateUniqueOpens,
    approximateUniqueClicks,
    clicksByLinkId: clicksByLinkRaw.map((row) => ({
      linkId: row.linkId ?? "unknown",
      count: row._count.id,
    })),
    eventsByCampaign,
    recentEvents,
    campaigns: campaignsRaw
      .map((r) => r.campaignId)
      .filter((id): id is string => id !== null),
  };
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
  "created_at",
  "recipient_token",
  "message_id",
] as const;

export function eventToCsvRow(event: {
  id: string;
  eventType: string;
  campaignId: string | null;
  linkId: string | null;
  destinationUrl: string | null;
  ipHash: string | null;
  ipCountry: string | null;
  ipRegion: string | null;
  ipCity: string | null;
  userAgent: string | null;
  isBot: boolean;
  createdAt: Date;
  recipientToken: string | null;
  messageId: string | null;
}): string {
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
    event.createdAt,
    event.recipientToken,
    event.messageId,
  ]
    .map(escapeCsvField)
    .join(",");
}
