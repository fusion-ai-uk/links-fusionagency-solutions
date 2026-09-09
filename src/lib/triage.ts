import { prisma } from "@/lib/prisma";
import {
  getLiveWindow,
  getTestCampaignId,
  isTestCampaignId,
  baseCampaignId,
} from "@/config/programmes";
import {
  clusterClicks,
  DEFAULT_ECHO_WINDOW_SECONDS,
  type ClickEvent,
} from "@/lib/duplication";

/**
 * Event triage — deciding what is real.
 *
 * Every event gets a PHASE, from configuration alone:
 *   test      — recorded on a `-test` campaign ID
 *   pre-send  — recorded on the live campaign ID before the email was sent
 *               (status not yet "sent", or before its liveFrom moment)
 *   live      — recorded on the live campaign ID at or after liveFrom
 *
 * Every LIVE click then gets one REASON, applied in this order — the first
 * that matches wins:
 *   bot       — user agent matched a bot / scanner / proxy pattern
 *   internal  — same device (hashed IP + user agent) that produced test or
 *               pre-send events in this scope: a tester looking at the live email
 *   echo      — near-simultaneous click on the same link from another address
 *   repeat    — near-simultaneous click on the same link from the same address
 *   genuine   — none of the above
 *
 * The phase and reason are computed, never stored, so a change to the rules
 * or to a campaign's liveFrom re-triages history consistently.
 */

export type Phase = "test" | "pre-send" | "live";
export type TriageReason =
  | "bot"
  | "internal"
  | "echo"
  | "repeat"
  | "genuine";

export interface TriageInput {
  id: string;
  eventType: string;
  campaignId: string | null;
  linkId: string | null;
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

export interface Triaged {
  phase: Phase;
  /** Null for test and pre-send events — they are not triaged further. */
  reason: TriageReason | null;
}

export interface TriageCounts {
  raw: number;
  test: number;
  preSend: number;
  live: number;
  bot: number;
  internal: number;
  echo: number;
  repeat: number;
  genuine: number;
}

export interface TriageResult {
  byId: Map<string, Triaged>;
  clicks: TriageCounts;
  opens: TriageCounts;
  /** Distinct hashed IP + user agent among genuine clicks. */
  genuineApproxUniqueClicks: number;
  /** Distinct hashed IP + user agent among live, non-bot, non-internal opens. */
  genuineApproxUniqueOpens: number;
  windowSeconds: number;
  /** Devices treated as internal testers in this scope. */
  internalDevices: number;
}

const emptyCounts = (): TriageCounts => ({
  raw: 0, test: 0, preSend: 0, live: 0, bot: 0, internal: 0, echo: 0, repeat: 0, genuine: 0,
});

const deviceKey = (e: { ipHash: string | null; userAgent: string | null }) =>
  `${e.ipHash ?? ""}|${e.userAgent ?? ""}`;

export function phaseOf(campaignId: string | null, createdAt: Date): Phase {
  if (!campaignId) return "live";
  if (isTestCampaignId(campaignId)) return "test";
  const window = getLiveWindow(campaignId);
  if (!window) return "live";
  if (window.from === null) return "pre-send";
  return createdAt < window.from ? "pre-send" : "live";
}

/** Pure: triage a set of events already loaded. */
export function triageEvents(
  events: TriageInput[],
  windowSeconds: number = DEFAULT_ECHO_WINDOW_SECONDS
): TriageResult {
  const byId = new Map<string, Triaged>();
  const clicks = emptyCounts();
  const opens = emptyCounts();

  // Pass 1: phases, and the set of devices that have been used for testing.
  const internal = new Set<string>();
  const phased = events.map((e) => {
    const phase = phaseOf(e.campaignId, e.createdAt);
    if (phase !== "live" && (e.ipHash || e.userAgent)) internal.add(deviceKey(e));
    return { e, phase };
  });

  // Pass 2: bots and internal devices among live events.
  const liveClicksForClustering: ClickEvent[] = [];
  for (const { e, phase } of phased) {
    const counts = e.eventType === "click" ? clicks : opens;
    counts.raw++;

    if (phase === "test") {
      counts.test++;
      byId.set(e.id, { phase, reason: null });
      continue;
    }
    if (phase === "pre-send") {
      counts.preSend++;
      byId.set(e.id, { phase, reason: null });
      continue;
    }

    counts.live++;
    if (e.isBot) {
      counts.bot++;
      byId.set(e.id, { phase, reason: "bot" });
      continue;
    }
    if (internal.has(deviceKey(e))) {
      counts.internal++;
      byId.set(e.id, { phase, reason: "internal" });
      continue;
    }
    if (e.eventType === "click" && e.linkId) {
      liveClicksForClustering.push({
        ...e,
        campaignId: e.campaignId ?? "unknown",
        linkId: e.linkId,
      });
    } else {
      // Opens are not clustered; a live, non-bot, non-internal open is as
      // genuine as an open gets.
      counts.genuine++;
      byId.set(e.id, { phase, reason: "genuine" });
    }
  }

  // Pass 3: near-simultaneous echoes and repeats among the remaining clicks.
  for (const cluster of clusterClicks(liveClicksForClustering, windowSeconds)) {
    for (const ev of cluster.events) {
      const reason: TriageReason =
        ev.role === "primary" ? "genuine" : ev.role === "echo" ? "echo" : "repeat";
      clicks[reason]++;
      byId.set(ev.id, { phase: "live", reason });
    }
  }

  const genuineKeys = (type: string) =>
    new Set(
      events
        .filter((e) => e.eventType === type && byId.get(e.id)?.reason === "genuine")
        .map(deviceKey)
    ).size;

  return {
    byId,
    clicks,
    opens,
    genuineApproxUniqueClicks: genuineKeys("click"),
    genuineApproxUniqueOpens: genuineKeys("open"),
    windowSeconds,
    internalDevices: internal.size,
  };
}

const TRIAGE_SELECT = {
  id: true,
  eventType: true,
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
} as const;

/**
 * Load and triage everything recorded for a set of LIVE campaign IDs, including
 * their test twins (needed to learn which devices are testers).
 */
export async function loadTriage(
  liveCampaignIds: string[],
  windowSeconds: number = DEFAULT_ECHO_WINDOW_SECONDS
): Promise<TriageResult & { events: TriageInput[] }> {
  const ids = Array.from(
    new Set(liveCampaignIds.flatMap((id) => [baseCampaignId(id), getTestCampaignId(id)]))
  );
  if (ids.length === 0) {
    return { ...triageEvents([], windowSeconds), events: [] };
  }
  const events = await prisma.emailEvent.findMany({
    where: { campaignId: { in: ids } },
    orderBy: { createdAt: "asc" },
    select: TRIAGE_SELECT,
  });
  return { ...triageEvents(events, windowSeconds), events };
}

export const PHASE_LABELS: Record<Phase, string> = {
  test: "Test",
  "pre-send": "Pre-send",
  live: "Live",
};

export const REASON_LABELS: Record<TriageReason, string> = {
  bot: "Likely bot",
  internal: "Likely internal",
  echo: "Scanner echo",
  repeat: "Repeat click",
  genuine: "Genuine",
};
