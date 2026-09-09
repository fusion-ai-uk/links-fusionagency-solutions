import { prisma } from "@/lib/prisma";
import {
  getCampaignDefinition,
  getLiveWindow,
  getTestCampaignId,
  isTestCampaignId,
  baseCampaignId,
  type LiveWindow,
} from "@/config/programmes";
import {
  clusterClicks,
  DEFAULT_ECHO_WINDOW_SECONDS,
  type ClickEvent,
} from "@/lib/duplication";
import {
  countOpensByUkDay,
  detectSend,
  SEND_DETECTION_MIN_OPENS_PER_DAY,
  type DetectedSend,
} from "@/lib/send-detection";

/**
 * Click confidence — how sure we are that an event is a recipient engaging.
 *
 * Every event gets a PHASE, from configuration (or a detected send):
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
 *   confirmed — none of the above
 *
 * The phase and reason are computed, never stored, so a change to the rules
 * or to a campaign's liveFrom re-assesses history consistently.
 *
 * When config does not yet say an email has been sent, the send is detected
 * from the data (see send-detection.ts) and used as the live-from moment until
 * config catches up.
 */

export type Phase = "test" | "pre-send" | "live";
export type ConfidenceReason =
  | "bot"
  | "internal"
  | "echo"
  | "repeat"
  | "confirmed";

export interface ConfidenceInput {
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

export interface Assessed {
  phase: Phase;
  /** Null for test and pre-send events — they are not assessed further. */
  reason: ConfidenceReason | null;
}

export interface ConfidenceCounts {
  raw: number;
  test: number;
  preSend: number;
  live: number;
  bot: number;
  internal: number;
  echo: number;
  repeat: number;
  confirmed: number;
}

/** Where an email's live-from moment came from. */
export type SendSource = "config" | "detected";

export interface SendInfo {
  campaignId: string;
  at: Date;
  source: SendSource;
  /** Present when the send was found in the data (even if config later confirmed it). */
  detected: DetectedSend | null;
}

export interface ConfidenceResult {
  byId: Map<string, Assessed>;
  clicks: ConfidenceCounts;
  opens: ConfidenceCounts;
  /** Distinct hashed IP + user agent among confirmed clicks. */
  confirmedApproxUniqueClicks: number;
  /** Distinct hashed IP + user agent among live, non-bot, non-internal opens. */
  confirmedApproxUniqueOpens: number;
  windowSeconds: number;
  /** Devices treated as internal testers in this scope. */
  internalDevices: number;
  /** The send moment per live campaign ID, from config or detected in the data. */
  sends: Map<string, SendInfo>;
  /** Non-bot opens per UK day per live campaign ID — the material for bursts and the timeline. */
  opensByDay: Map<string, Map<string, number>>;
}

const emptyCounts = (): ConfidenceCounts => ({
  raw: 0, test: 0, preSend: 0, live: 0, bot: 0, internal: 0, echo: 0, repeat: 0, confirmed: 0,
});

const deviceKey = (e: { ipHash: string | null; userAgent: string | null }) =>
  `${e.ipHash ?? ""}|${e.userAgent ?? ""}`;

/**
 * The live window actually applied: config first; a detected send only when
 * config says the email has not been sent yet.
 */
export function effectiveLiveWindow(
  campaignId: string,
  detected: Map<string, DetectedSend>
): LiveWindow | null {
  const window = getLiveWindow(campaignId);
  if (window && window.from === null) {
    const found = detected.get(baseCampaignId(campaignId));
    if (found) return { campaignId: window.campaignId, from: found.at };
  }
  return window;
}

export function phaseOf(
  campaignId: string | null,
  createdAt: Date,
  detected: Map<string, DetectedSend> = new Map()
): Phase {
  if (!campaignId) return "live";
  if (isTestCampaignId(campaignId)) return "test";
  const window = effectiveLiveWindow(campaignId, detected);
  if (!window) return "live";
  if (window.from === null) return "pre-send";
  return createdAt < window.from ? "pre-send" : "live";
}

/** Detect sends from the opens on each live campaign ID in a set of events. */
export function detectSends(events: ConfidenceInput[]): {
  detected: Map<string, DetectedSend>;
  opensByDay: Map<string, Map<string, number>>;
} {
  const opensByCampaign = new Map<string, { createdAt: Date; isBot: boolean }[]>();
  for (const e of events) {
    if (e.eventType !== "open" || !e.campaignId || isTestCampaignId(e.campaignId)) continue;
    const list = opensByCampaign.get(e.campaignId) ?? [];
    list.push({ createdAt: e.createdAt, isBot: e.isBot });
    opensByCampaign.set(e.campaignId, list);
  }
  const detected = new Map<string, DetectedSend>();
  const opensByDay = new Map<string, Map<string, number>>();
  for (const [cid, opens] of opensByCampaign) {
    opensByDay.set(cid, countOpensByUkDay(opens));
    const threshold =
      getCampaignDefinition(cid)?.detectSendAtOpens ?? SEND_DETECTION_MIN_OPENS_PER_DAY;
    const found = detectSend(opens, threshold);
    if (found) detected.set(cid, found);
  }
  return { detected, opensByDay };
}

function describeSends(
  campaignIds: Iterable<string>,
  detected: Map<string, DetectedSend>
): Map<string, SendInfo> {
  const sends = new Map<string, SendInfo>();
  for (const raw of campaignIds) {
    const cid = baseCampaignId(raw);
    if (sends.has(cid)) continue;
    const config = getLiveWindow(cid);
    const found = detected.get(cid) ?? null;
    if (config?.from) {
      sends.set(cid, { campaignId: cid, at: config.from, source: "config", detected: found });
    } else if (found) {
      sends.set(cid, { campaignId: cid, at: found.at, source: "detected", detected: found });
    }
  }
  return sends;
}

/** Pure: assess a set of events already loaded. */
export function assessEvents(
  events: ConfidenceInput[],
  windowSeconds: number = DEFAULT_ECHO_WINDOW_SECONDS
): ConfidenceResult {
  const byId = new Map<string, Assessed>();
  const clicks = emptyCounts();
  const opens = emptyCounts();

  // Pass 0: find the send moment for any email config has not marked sent.
  const { detected, opensByDay } = detectSends(events);

  // Pass 1: phases, and the set of devices that have been used for testing.
  const internal = new Set<string>();
  const phased = events.map((e) => {
    const phase = phaseOf(e.campaignId, e.createdAt, detected);
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
      // confirmed as an open gets.
      counts.confirmed++;
      byId.set(e.id, { phase, reason: "confirmed" });
    }
  }

  // Pass 3: near-simultaneous echoes and repeats among the remaining clicks.
  for (const cluster of clusterClicks(liveClicksForClustering, windowSeconds)) {
    for (const ev of cluster.events) {
      const reason: ConfidenceReason =
        ev.role === "primary" ? "confirmed" : ev.role === "echo" ? "echo" : "repeat";
      clicks[reason]++;
      byId.set(ev.id, { phase: "live", reason });
    }
  }

  const confirmedKeys = (type: string) =>
    new Set(
      events
        .filter((e) => e.eventType === type && byId.get(e.id)?.reason === "confirmed")
        .map(deviceKey)
    ).size;

  const campaignIds = new Set<string>();
  for (const e of events) if (e.campaignId) campaignIds.add(baseCampaignId(e.campaignId));

  return {
    byId,
    clicks,
    opens,
    confirmedApproxUniqueClicks: confirmedKeys("click"),
    confirmedApproxUniqueOpens: confirmedKeys("open"),
    windowSeconds,
    internalDevices: internal.size,
    sends: describeSends(campaignIds, detected),
    opensByDay,
  };
}

const CONFIDENCE_SELECT = {
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
 * Load and assess everything recorded for a set of LIVE campaign IDs, including
 * their test twins (needed to learn which devices are testers).
 */
export async function loadConfidence(
  liveCampaignIds: string[],
  windowSeconds: number = DEFAULT_ECHO_WINDOW_SECONDS
): Promise<ConfidenceResult & { events: ConfidenceInput[] }> {
  const ids = Array.from(
    new Set(liveCampaignIds.flatMap((id) => [baseCampaignId(id), getTestCampaignId(id)]))
  );
  if (ids.length === 0) {
    return { ...assessEvents([], windowSeconds), events: [] };
  }
  const events = await prisma.emailEvent.findMany({
    where: { campaignId: { in: ids } },
    orderBy: { createdAt: "asc" },
    select: CONFIDENCE_SELECT,
  });
  const result = assessEvents(events, windowSeconds);
  // Emails in scope with a config live-from but no events yet still get a send entry.
  for (const id of liveCampaignIds) {
    const cid = baseCampaignId(id);
    if (result.sends.has(cid)) continue;
    const config = getLiveWindow(cid);
    if (config?.from) {
      result.sends.set(cid, { campaignId: cid, at: config.from, source: "config", detected: null });
    }
  }
  return { ...result, events };
}

export const PHASE_LABELS: Record<Phase, string> = {
  test: "Test",
  "pre-send": "Pre-send",
  live: "Live",
};

export const REASON_LABELS: Record<ConfidenceReason, string> = {
  bot: "Likely bot",
  internal: "Likely internal",
  echo: "Scanner echo",
  repeat: "Repeat click",
  confirmed: "Confirmed",
};
