import { Prisma, type EmailEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNKNOWN_CAMPAIGN } from "@/lib/tracking";
import {
  buildEventWhere,
  buildRawWhere,
  type DashboardFilters,
} from "@/lib/event-filters";
import {
  DEFAULT_ECHO_WINDOW_SECONDS,
  loadClickClusters,
  summariseClusters,
  type DuplicationSummary,
} from "@/lib/duplication";

export { buildEventWhere, type DashboardFilters } from "@/lib/event-filters";

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
  ipCity: string | null;
  isBot: boolean;
  botReason: string | null;
  clientKind: string | null;
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
  /** Present when near-simultaneous echoes were collapsed. */
  collapse: DuplicationSummary | null;
  /** IDs of events labelled echo or repeat, for marking the recent list. */
  echoEventIds: Set<string>;
  repeatEventIds: Set<string>;
}

export interface DashboardOptions {
  /** Count one click per near-simultaneous cluster instead of every event. */
  collapseEchoes?: boolean;
  echoWindowSeconds?: number;
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

function emptyCampaignMetrics(campaignId: string): CampaignMetrics {
  return {
    campaignId,
    opens: 0,
    clicks: 0,
    approxUniqueOpens: 0,
    approxUniqueClicks: 0,
  };
}

function rowsToMetrics(rows: CampaignRow[]): Map<string, CampaignMetrics> {
  const byCampaign = new Map<string, CampaignMetrics>();
  for (const row of rows) {
    const metrics =
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
  return byCampaign;
}

export async function getDashboardStats(
  filters: DashboardFilters = {},
  options: DashboardOptions = {}
): Promise<DashboardStats> {
  const where = buildEventWhere(filters);
  const windowSeconds = options.echoWindowSeconds ?? DEFAULT_ECHO_WINDOW_SECONDS;

  const [campaignRows, overallUniques, clicksByLinkRaw, recentEvents, clusters] =
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
          ipCity: true,
          isBot: true,
          botReason: true,
          clientKind: true,
          createdAt: true,
        },
      }),
      // Clusters are always computed so the recent list can flag echoes even
      // when counts are not being collapsed.
      loadClickClusters(filters, windowSeconds),
    ]);

  const byCampaign = rowsToMetrics(campaignRows);

  const echoEventIds = new Set<string>();
  const repeatEventIds = new Set<string>();
  for (const cluster of clusters) {
    for (const event of cluster.events) {
      if (event.role === "echo") echoEventIds.add(event.id);
      if (event.role === "repeat") repeatEventIds.add(event.id);
    }
  }

  let clicksByLinkId = clicksByLinkRaw.map((row) => ({
    linkId: row.linkId ?? "unknown",
    count: row._count.id,
  }));
  let approximateUniqueClicks = overallUniques.get("click") ?? 0;
  let collapse: DuplicationSummary | null = null;

  if (options.collapseEchoes) {
    collapse = summariseClusters(clusters, windowSeconds);

    // One click per cluster, everywhere clicks are counted.
    const perCampaign = new Map<string, number>();
    const perLink = new Map<string, number>();
    const primaryKeys = new Set<string>();
    for (const cluster of clusters) {
      perCampaign.set(
        cluster.campaignId,
        (perCampaign.get(cluster.campaignId) ?? 0) + 1
      );
      perLink.set(cluster.linkId, (perLink.get(cluster.linkId) ?? 0) + 1);
      primaryKeys.add(
        `${cluster.primary.ipHash ?? ""}|${cluster.primary.userAgent ?? ""}`
      );
    }

    for (const [campaignId, metrics] of byCampaign) {
      metrics.clicks = perCampaign.get(campaignId) ?? 0;
    }
    clicksByLinkId = [...perLink.entries()]
      .map(([linkId, count]) => ({ linkId, count }))
      .sort((a, b) => b.count - a.count);
    approximateUniqueClicks = primaryKeys.size;
  }

  const metricsByCampaign = Array.from(byCampaign.values()).sort(
    (a, b) => b.opens + b.clicks - (a.opens + a.clicks)
  );

  return {
    totalOpens: metricsByCampaign.reduce((sum, m) => sum + m.opens, 0),
    totalClicks: metricsByCampaign.reduce((sum, m) => sum + m.clicks, 0),
    approximateUniqueOpens: overallUniques.get("open") ?? 0,
    approximateUniqueClicks,
    clicksByLinkId,
    metricsByCampaign,
    recentEvents,
    collapse,
    echoEventIds,
    repeatEventIds,
  };
}

/**
 * Per-campaign metrics only — one query. Used for side panels such as the
 * test-send counters, where the full dashboard payload is not needed.
 */
export async function getCampaignMetrics(
  filters: DashboardFilters,
  options: DashboardOptions = {}
): Promise<CampaignMetrics[]> {
  const rows = await getCampaignRows(filters);
  const byCampaign = rowsToMetrics(rows);

  if (options.collapseEchoes) {
    const clusters = await loadClickClusters(
      filters,
      options.echoWindowSeconds ?? DEFAULT_ECHO_WINDOW_SECONDS
    );
    const perCampaign = new Map<string, number>();
    for (const cluster of clusters) {
      perCampaign.set(
        cluster.campaignId,
        (perCampaign.get(cluster.campaignId) ?? 0) + 1
      );
    }
    for (const [campaignId, metrics] of byCampaign) {
      metrics.clicks = perCampaign.get(campaignId) ?? 0;
    }
  }

  return Array.from(byCampaign.values());
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
