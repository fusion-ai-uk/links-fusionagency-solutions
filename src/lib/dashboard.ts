import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNKNOWN_CAMPAIGN } from "@/lib/tracking";

export interface DashboardFilters {
  /**
   * Restrict to these campaign IDs (a programme's waves, or a single wave).
   * `null`/`undefined` means no restriction; `[]` means match nothing.
   */
  campaignIds?: string[] | null;
  /** Drop rows flagged by the bot/scanner heuristic. */
  excludeBots?: boolean;
}

export interface CampaignMetrics {
  campaignId: string;
  opens: number;
  clicks: number;
  approxUniqueOpens: number;
  approxUniqueClicks: number;
}

export interface RecentEvent {
  id: string;
  eventType: string;
  campaignId: string | null;
  linkId: string | null;
  destinationUrl: string | null;
  ipCountry: string | null;
  isBot: boolean;
  createdAt: Date;
}

export interface DashboardStats {
  totalOpens: number;
  totalClicks: number;
  approximateUniqueOpens: number;
  approximateUniqueClicks: number;
  clicksByLinkId: { linkId: string; count: number }[];
  metricsByCampaign: CampaignMetrics[];
  recentEvents: RecentEvent[];
}

/** Rows with a NULL campaign_id are reported as "unknown". */
function includesUnknown(campaignIds: string[]): boolean {
  return campaignIds.includes(UNKNOWN_CAMPAIGN);
}

/** WHERE clause for raw SQL, including the leading `WHERE` (or empty). */
function buildRawWhere(filters: DashboardFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  const { campaignIds, excludeBots } = filters;

  if (campaignIds) {
    if (campaignIds.length === 0) {
      clauses.push(Prisma.sql`false`);
    } else {
      clauses.push(
        Prisma.sql`COALESCE(campaign_id, ${UNKNOWN_CAMPAIGN}) IN (${Prisma.join(
          campaignIds
        )})`
      );
    }
  }

  if (excludeBots) {
    clauses.push(Prisma.sql`is_bot = false`);
  }

  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}`;
}

/** Equivalent filter for the Prisma query builder. */
function buildWhere(filters: DashboardFilters): Prisma.EmailEventWhereInput {
  const where: Prisma.EmailEventWhereInput = {};
  const { campaignIds, excludeBots } = filters;

  if (campaignIds) {
    if (campaignIds.length === 0) {
      where.campaignId = { in: [] };
    } else if (includesUnknown(campaignIds)) {
      where.OR = [{ campaignId: { in: campaignIds } }, { campaignId: null }];
    } else {
      where.campaignId = { in: campaignIds };
    }
  }

  if (excludeBots) {
    where.isBot = false;
  }

  return where;
}

type CampaignRow = {
  campaign_id: string;
  event_type: string;
  total: bigint;
  approx_unique: bigint;
};

/**
 * Per-campaign totals plus approximate unique counts in one pass.
 *
 * "Approximate unique" = distinct ip_hash + user_agent within a campaign and
 * event type. It is a directional de-duplication only and must never be read as
 * a recipient count.
 */
async function getCampaignRows(
  filters: DashboardFilters
): Promise<CampaignRow[]> {
  return prisma.$queryRaw<CampaignRow[]>(
    Prisma.sql`
      SELECT
        COALESCE(campaign_id, ${UNKNOWN_CAMPAIGN}) AS campaign_id,
        event_type,
        COUNT(*)::bigint AS total,
        COUNT(DISTINCT (
          COALESCE(ip_hash, '') || '|' || COALESCE(user_agent, '')
        ))::bigint AS approx_unique
      FROM email_events
      ${buildRawWhere(filters)}
      GROUP BY 1, 2
    `
  );
}

type OverallRow = { event_type: string; approx_unique: bigint };

/** Approximate uniques across the whole filtered set (not a sum of campaigns). */
async function getOverallUniques(
  filters: DashboardFilters
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<OverallRow[]>(
    Prisma.sql`
      SELECT
        event_type,
        COUNT(DISTINCT (
          COALESCE(ip_hash, '') || '|' || COALESCE(user_agent, '')
        ))::bigint AS approx_unique
      FROM email_events
      ${buildRawWhere(filters)}
      GROUP BY 1
    `
  );

  return new Map(rows.map((row) => [row.event_type, Number(row.approx_unique)]));
}

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

export async function getDashboardStats(
  filters: DashboardFilters = {}
): Promise<DashboardStats> {
  const where = buildWhere(filters);

  const [campaignRows, overallUniques, clicksByLinkRaw, recentEvents] =
    await Promise.all([
      getCampaignRows(filters),
      getOverallUniques(filters),
      prisma.emailEvent.groupBy({
        by: ["linkId"],
        where: { ...where, eventType: "click", linkId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
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
    ]);

  const byCampaign = new Map<string, CampaignMetrics>();

  for (const row of campaignRows) {
    const metrics: CampaignMetrics = byCampaign.get(row.campaign_id) ?? {
      campaignId: row.campaign_id,
      opens: 0,
      clicks: 0,
      approxUniqueOpens: 0,
      approxUniqueClicks: 0,
    };

    if (row.event_type === "open") {
      metrics.opens = Number(row.total);
      metrics.approxUniqueOpens = Number(row.approx_unique);
    } else if (row.event_type === "click") {
      metrics.clicks = Number(row.total);
      metrics.approxUniqueClicks = Number(row.approx_unique);
    }

    byCampaign.set(row.campaign_id, metrics);
  }

  const metricsByCampaign = Array.from(byCampaign.values()).sort(
    (a, b) => b.opens + b.clicks - (a.opens + a.clicks)
  );

  const totalOpens = metricsByCampaign.reduce((sum, m) => sum + m.opens, 0);
  const totalClicks = metricsByCampaign.reduce((sum, m) => sum + m.clicks, 0);

  return {
    totalOpens,
    totalClicks,
    approximateUniqueOpens: overallUniques.get("open") ?? 0,
    approximateUniqueClicks: overallUniques.get("click") ?? 0,
    clicksByLinkId: clicksByLinkRaw.map((row) => ({
      linkId: row.linkId ?? "unknown",
      count: row._count.id,
    })),
    metricsByCampaign,
    recentEvents,
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

/** Shared filter builder so the CSV export matches the dashboard view. */
export function buildEventWhere(
  filters: DashboardFilters
): Prisma.EmailEventWhereInput {
  return buildWhere(filters);
}

/**
 * Per-campaign metrics only — one query. Used for side panels such as the
 * test-send counters, where the full dashboard payload is not needed.
 */
export async function getCampaignMetrics(
  filters: DashboardFilters
): Promise<CampaignMetrics[]> {
  const rows = await getCampaignRows(filters);
  const byCampaign = new Map<string, CampaignMetrics>();

  for (const row of rows) {
    const metrics: CampaignMetrics =
      byCampaign.get(row.campaign_id) ?? emptyCampaignMetrics(row.campaign_id);

    if (row.event_type === "open") {
      metrics.opens = Number(row.total);
      metrics.approxUniqueOpens = Number(row.approx_unique);
    } else if (row.event_type === "click") {
      metrics.clicks = Number(row.total);
      metrics.approxUniqueClicks = Number(row.approx_unique);
    }

    byCampaign.set(row.campaign_id, metrics);
  }

  return Array.from(byCampaign.values());
}

function emptyCampaignMetrics(campaignId: string): CampaignMetrics {
  return {
    campaignId,
    opens: 0,
    clicks: 0,
    approxUniqueOpens: 0,
    approxUniqueClicks: 0,
  };
}
