import { prisma } from "@/lib/prisma";

/** One row in the setup page's activity feed. */
export interface CampaignEvent {
  id: string;
  eventType: string;
  campaignId: string | null;
  linkId: string | null;
  ipCountry: string | null;
  ipCity: string | null;
  userAgent: string | null;
  isBot: boolean;
  createdAt: Date;
}

/** Latest events across the given campaign IDs (a live cid and its test twin). */
export async function getRecentEventsForCampaigns(
  campaignIds: string[],
  take = 30
): Promise<CampaignEvent[]> {
  if (campaignIds.length === 0) return [];
  return prisma.emailEvent.findMany({
    where: { campaignId: { in: campaignIds } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      eventType: true,
      campaignId: true,
      linkId: true,
      ipCountry: true,
      ipCity: true,
      userAgent: true,
      isBot: true,
      createdAt: true,
    },
  });
}

/** Click counts per campaign ID and link ID, so a test can be checked link by link. */
export async function getClicksByLinkForCampaigns(
  campaignIds: string[]
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>();
  if (campaignIds.length === 0) return result;

  const rows = await prisma.emailEvent.groupBy({
    by: ["campaignId", "linkId"],
    where: {
      campaignId: { in: campaignIds },
      eventType: "click",
      linkId: { not: null },
    },
    _count: { id: true },
  });

  for (const row of rows) {
    if (!row.campaignId || !row.linkId) continue;
    const perLink = result.get(row.campaignId) ?? new Map<string, number>();
    perLink.set(row.linkId, row._count.id);
    result.set(row.campaignId, perLink);
  }
  return result;
}

/** A short, readable form of a user agent for tables. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "—";
  const ua = userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : null;
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : /Outlook/i.test(ua) ? "Outlook"
    : null;
  const parts = [browser, os].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return ua.length > 44 ? `${ua.slice(0, 41)}…` : ua;
}
