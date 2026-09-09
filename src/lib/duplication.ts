import { prisma } from "@/lib/prisma";
import { buildEventWhere, type DashboardFilters } from "@/lib/event-filters";

/**
 * Near-simultaneous click clustering.
 *
 * Two clicks on the same link within a few seconds of each other are, far more
 * often than not, one person: either a link-protection scanner fetching the
 * URL a moment before (or after) the recipient's browser follows it, or the
 * same person clicking twice. We group those into a cluster, choose the event
 * that looks most like a person as the primary, and label the rest.
 *
 *   echo   — a non-primary event from a *different* address. The scanner
 *            signature: seconds apart, often a different country.
 *   repeat — a non-primary event from the *same* address. Someone clicking
 *            again, or a refresh.
 *
 * This is a heuristic. The window is adjustable, the clusters are shown in
 * full on the duplication page, and nothing is deleted — collapsing only
 * changes how clicks are counted.
 */

export const DEFAULT_ECHO_WINDOW_SECONDS = 10;
export const ECHO_WINDOW_OPTIONS = [5, 10, 30, 60] as const;

export interface ClickEvent {
  id: string;
  campaignId: string;
  linkId: string;
  ipHash: string | null;
  ipCountry: string | null;
  ipRegion: string | null;
  ipCity: string | null;
  userAgent: string | null;
  isBot: boolean;
  botReason: string | null;
  clientKind: string | null;
  secFetchUser: string | null;
  createdAt: Date;
}

export type ClusterRole = "primary" | "echo" | "repeat";

export interface ClusterEvent extends ClickEvent {
  role: ClusterRole;
  /** Seconds after the cluster's first event. */
  offsetSeconds: number;
}

export type ClusterKind = "single" | "repeat" | "echo" | "mixed";

export interface ClickCluster {
  key: string;
  campaignId: string;
  linkId: string;
  startedAt: Date;
  endedAt: Date;
  spanSeconds: number;
  events: ClusterEvent[];
  primary: ClusterEvent;
  kind: ClusterKind;
}

export interface CountryCount {
  country: string;
  count: number;
}

export interface DuplicationSummary {
  windowSeconds: number;
  totalClicks: number;
  /** One per cluster — what "collapsed" click counts report. */
  collapsedClicks: number;
  clusters: number;
  singleClusters: number;
  echoClusters: number;
  repeatClusters: number;
  mixedClusters: number;
  echoEvents: number;
  repeatEvents: number;
  /** Where the echo side of clusters came from. */
  echoCountries: CountryCount[];
  /** Where the primary side of echo clusters came from. */
  primaryCountriesInEchoClusters: CountryCount[];
  /** Typical gap between primary and echo, in seconds. */
  echoGapMedianSeconds: number | null;
  echoGapMaxSeconds: number | null;
  /** Echo events whose country differed from their primary's. */
  echoesInDifferentCountry: number;
  /** Echo events with no browser hints at all. */
  echoesWithoutBrowserHints: number;
  /** Echo events recorded before hints were captured. */
  echoesWithoutHintData: number;
}

function secondsBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 1000;
}

function modal(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The country a campaign's audience most plausibly sits in, derived from its
 * own data: the most common country among browser-navigation clicks that were
 * not flagged as bots. Falls back to all non-bot clicks for older data.
 */
export function expectedCountryByCampaign(
  events: ClickEvent[]
): Map<string, string | null> {
  const byCampaign = new Map<string, ClickEvent[]>();
  for (const event of events) {
    const list = byCampaign.get(event.campaignId) ?? [];
    list.push(event);
    byCampaign.set(event.campaignId, list);
  }

  const result = new Map<string, string | null>();
  for (const [campaignId, list] of byCampaign) {
    const human = list.filter((e) => !e.isBot);
    const navigations = human.filter((e) => e.clientKind === "navigation");
    const pool = navigations.length > 0 ? navigations : human;
    result.set(campaignId, modal(pool.map((e) => e.ipCountry)));
  }
  return result;
}

/** Higher is more person-like. */
function humanScore(
  event: ClickEvent,
  expectedCountry: string | null,
  index: number
): number {
  let score = 0;
  if (event.isBot) score -= 10;
  if (event.clientKind === "navigation") score += 4;
  if (event.secFetchUser === "?1") score += 1;
  if (event.clientKind === "none") score -= 1;
  if (expectedCountry && event.ipCountry === expectedCountry) score += 2;
  // Scanners tend to fetch first and hand over to the browser, so on a tie
  // prefer the later event. Kept tiny so it never outweighs a real signal.
  score += index * 0.001;
  return score;
}

/**
 * Group clicks on the same campaign + link that fall within `windowSeconds`
 * of the previous click, then choose a primary per cluster.
 */
export function clusterClicks(
  events: ClickEvent[],
  windowSeconds: number = DEFAULT_ECHO_WINDOW_SECONDS
): ClickCluster[] {
  const sorted = [...events].sort(
    (a, b) =>
      a.campaignId.localeCompare(b.campaignId) ||
      a.linkId.localeCompare(b.linkId) ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );

  const expected = expectedCountryByCampaign(events);
  const groups: ClickEvent[][] = [];
  let current: ClickEvent[] = [];

  for (const event of sorted) {
    const last = current[current.length - 1];
    const continues =
      last &&
      last.campaignId === event.campaignId &&
      last.linkId === event.linkId &&
      secondsBetween(last.createdAt, event.createdAt) <= windowSeconds;

    if (continues) {
      current.push(event);
    } else {
      if (current.length) groups.push(current);
      current = [event];
    }
  }
  if (current.length) groups.push(current);

  return groups.map((group) => {
    const expectedCountry = expected.get(group[0].campaignId) ?? null;

    let primaryIndex = 0;
    let bestScore = -Infinity;
    group.forEach((event, index) => {
      const score = humanScore(event, expectedCountry, index);
      if (score > bestScore) {
        bestScore = score;
        primaryIndex = index;
      }
    });

    const primarySource = group[primaryIndex];
    const startedAt = group[0].createdAt;
    const endedAt = group[group.length - 1].createdAt;

    const clusterEvents: ClusterEvent[] = group.map((event, index) => {
      let role: ClusterRole;
      if (index === primaryIndex) role = "primary";
      else if (event.ipHash && event.ipHash === primarySource.ipHash) {
        role = "repeat";
      } else role = "echo";

      return {
        ...event,
        role,
        offsetSeconds: secondsBetween(startedAt, event.createdAt),
      };
    });

    const primary = clusterEvents[primaryIndex];
    const hasEcho = clusterEvents.some((e) => e.role === "echo");
    const hasRepeat = clusterEvents.some((e) => e.role === "repeat");
    const kind: ClusterKind =
      group.length === 1
        ? "single"
        : hasEcho && hasRepeat
          ? "mixed"
          : hasEcho
            ? "echo"
            : "repeat";

    return {
      key: `${group[0].campaignId}|${group[0].linkId}|${startedAt.toISOString()}`,
      campaignId: group[0].campaignId,
      linkId: group[0].linkId,
      startedAt,
      endedAt,
      spanSeconds: secondsBetween(startedAt, endedAt),
      events: clusterEvents,
      primary,
      kind,
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function countBy(values: (string | null)[]): CountryCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

export function summariseClusters(
  clusters: ClickCluster[],
  windowSeconds: number
): DuplicationSummary {
  const echoes = clusters.flatMap((c) =>
    c.events
      .filter((e) => e.role === "echo")
      .map((e) => ({ event: e, primary: c.primary }))
  );
  const repeats = clusters.flatMap((c) =>
    c.events.filter((e) => e.role === "repeat")
  );

  const gaps = echoes.map(({ event, primary }) =>
    secondsBetween(primary.createdAt, event.createdAt)
  );

  return {
    windowSeconds,
    totalClicks: clusters.reduce((sum, c) => sum + c.events.length, 0),
    collapsedClicks: clusters.length,
    clusters: clusters.length,
    singleClusters: clusters.filter((c) => c.kind === "single").length,
    echoClusters: clusters.filter((c) => c.kind === "echo").length,
    repeatClusters: clusters.filter((c) => c.kind === "repeat").length,
    mixedClusters: clusters.filter((c) => c.kind === "mixed").length,
    echoEvents: echoes.length,
    repeatEvents: repeats.length,
    echoCountries: countBy(echoes.map(({ event }) => event.ipCountry)),
    primaryCountriesInEchoClusters: countBy(
      clusters
        .filter((c) => c.kind === "echo" || c.kind === "mixed")
        .map((c) => c.primary.ipCountry)
    ),
    echoGapMedianSeconds: median(gaps),
    echoGapMaxSeconds: gaps.length ? Math.max(...gaps) : null,
    echoesInDifferentCountry: echoes.filter(
      ({ event, primary }) =>
        event.ipCountry && primary.ipCountry && event.ipCountry !== primary.ipCountry
    ).length,
    echoesWithoutBrowserHints: echoes.filter(
      ({ event }) => event.clientKind === "none"
    ).length,
    echoesWithoutHintData: echoes.filter(({ event }) => event.clientKind === null)
      .length,
  };
}

/** Load every click in scope and cluster it. */
export async function loadClickClusters(
  filters: DashboardFilters,
  windowSeconds: number = DEFAULT_ECHO_WINDOW_SECONDS
): Promise<ClickCluster[]> {
  const rows = await prisma.emailEvent.findMany({
    where: {
      ...buildEventWhere(filters),
      eventType: "click",
      linkId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      campaignId: true,
      linkId: true,
      ipHash: true,
      ipCountry: true,
      ipRegion: true,
      ipCity: true,
      userAgent: true,
      isBot: true,
      botReason: true,
      clientKind: true,
      secFetchUser: true,
      createdAt: true,
    },
  });

  const events: ClickEvent[] = rows.map((row) => ({
    ...row,
    campaignId: row.campaignId ?? "unknown",
    linkId: row.linkId ?? "unknown",
  }));

  return clusterClicks(events, windowSeconds);
}

export function parseEchoWindow(value: string | undefined): number {
  const n = Number(value);
  return (ECHO_WINDOW_OPTIONS as readonly number[]).includes(n)
    ? n
    : DEFAULT_ECHO_WINDOW_SECONDS;
}

/** A short, readable form of a user agent for tables. */
export function shortUserAgent(userAgent: string | null): string {
  if (!userAgent) return "—";
  const ua = userAgent;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Macintosh|Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua) && /Version\//.test(ua)
            ? "Safari"
            : /Outlook/i.test(ua)
              ? "Outlook"
              : null;
  const parts = [browser, os].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return ua.length > 48 ? `${ua.slice(0, 45)}…` : ua;
}
