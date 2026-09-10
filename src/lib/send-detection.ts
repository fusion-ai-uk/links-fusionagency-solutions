import { ukDayAnchor, ukDayKey } from "@/lib/time";

/**
 * Send detection — catching the moment an email actually went out.
 *
 * Nobody tells this system when a send happens; the status in config is set
 * by hand, often later. But a send is unmistakable in the data: opens on the
 * live campaign ID jump from a handful a day (the build team checking links)
 * to dozens or hundreds within an hour.
 *
 * Two rules, applied in order:
 *
 *   1. VOLUME FLOOR. Only a UK calendar day with at least THRESHOLD non-bot
 *      opens (50 by default) can be a send day. The pre-send trickle never
 *      qualifies, however long it goes on.
 *
 *   2. RECALIBRATION. A modest day that clears the floor and is then dwarfed
 *      by the following day was probably not the send — a seed list, a test
 *      to a small group, or a false start. So among the qualifying days in the
 *      first week, each day's opens in the 24 HOURS FROM ITS BURST START are
 *      compared, and the send is the earliest day that reaches at least
 *      SEND_SHARE_OF_PEAK of the largest. 60 → 800 → 1,200 → 400 makes the
 *      800 day the send, not the 60 and not the 1,200 peak. 300 → 350 → 100
 *      keeps the 300 day. Rolling 24 hours rather than the calendar day means
 *      a late-afternoon send whose opens land the next morning is not
 *      penalised.
 *
 * Within the chosen day, the send moment is the start of the first burst —
 * the earliest open followed by enough further opens within half an hour.
 * Everything before that moment on the live ID is pre-send (testing);
 * everything from it is live.
 *
 * The result is computed on every load, so it recalibrates as data arrives.
 * It is used only while config has no better answer, i.e. the campaign is
 * not yet marked "sent". Recording `liveFrom` in config confirms it and takes
 * over. Qualifying days the detector passed over are reported so they can be
 * shown, never hidden; later days that clear the floor again are reported as
 * bursts (a resend, a reminder, a mail provider pre-fetching images). The
 * comparison window is a week, so a resend weeks later cannot move the send.
 */

export const SEND_DETECTION_MIN_OPENS_PER_DAY = 50;
/** A qualifying day must reach this share of the week's biggest first-24h to be the send. */
export const SEND_SHARE_OF_PEAK = 0.2;
/** Qualifying days this many days after the first are compared for the send. */
export const SEND_COMPARISON_DAYS = 7;
/** Opens that must follow the first one within BURST_WINDOW_MS to mark the start. */
const BURST_WINDOW_MS = 30 * 60_000;
const DAY_MS = 86_400_000;

export interface OpenSample {
  createdAt: Date;
  isBot: boolean;
}

export interface OpenBurst {
  day: string;
  opens: number;
}

export interface DetectedSend {
  /** The moment the send began — the effective live-from. */
  at: Date;
  /** UK day key (YYYY-MM-DD) of the send. */
  day: string;
  opensThatDay: number;
  /** Non-bot opens in the 24 hours from the send moment — the figure the days were compared on. */
  opensFirst24h: number;
  threshold: number;
  /** Earlier days that cleared the floor but were dwarfed by the send proper. */
  passedOver: OpenBurst[];
}

/** Non-bot opens per UK calendar day, in day order. */
export function countOpensByUkDay(opens: OpenSample[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of opens) {
    if (o.isBot) continue;
    const key = ukDayKey(o.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** The moment the first burst begins within one day's opens (sorted ascending). */
export function burstStart(dayOpens: Date[], threshold: number): Date | null {
  if (dayOpens.length === 0) return null;
  const k = Math.max(3, Math.ceil(threshold / 10));
  for (let i = 0; i + k - 1 < dayOpens.length; i++) {
    if (dayOpens[i + k - 1].getTime() - dayOpens[i].getTime() <= BURST_WINDOW_MS) {
      return dayOpens[i];
    }
  }
  return dayOpens[0];
}

interface Candidate {
  day: string;
  opensThatDay: number;
  at: Date;
  first24h: number;
}

/**
 * Detect the send from the opens recorded on one live campaign ID.
 * Returns null while no day has reached the threshold.
 */
export function detectSend(
  opens: OpenSample[],
  threshold: number = SEND_DETECTION_MIN_OPENS_PER_DAY
): DetectedSend | null {
  const byDay = countOpensByUkDay(opens);
  const sorted = opens
    .filter((o) => !o.isBot)
    .map((o) => o.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());

  // Rule 1: the volume floor.
  const candidates: Candidate[] = [];
  for (const [day, count] of byDay) {
    if (count < threshold) continue;
    const dayOpens = sorted.filter((d) => ukDayKey(d) === day);
    const at = burstStart(dayOpens, threshold) ?? dayOpens[0];
    const end = at.getTime() + DAY_MS;
    const first24h = sorted.filter((d) => d >= at && d.getTime() < end).length;
    candidates.push({ day, opensThatDay: count, at, first24h });
  }
  if (candidates.length === 0) return null;

  // Rule 2: recalibrate within the first week of qualifying days.
  const windowEnd = ukDayAnchor(candidates[0].day).getTime() + SEND_COMPARISON_DAYS * DAY_MS;
  const inWindow = candidates.filter((c) => ukDayAnchor(c.day).getTime() < windowEnd);
  const peak = Math.max(...inWindow.map((c) => c.first24h));
  const chosen = inWindow.find((c) => c.first24h >= SEND_SHARE_OF_PEAK * peak) ?? candidates[0];

  return {
    at: chosen.at,
    day: chosen.day,
    opensThatDay: chosen.opensThatDay,
    opensFirst24h: chosen.first24h,
    threshold,
    passedOver: inWindow.filter((c) => c.day < chosen.day).map((c) => ({ day: c.day, opens: c.opensThatDay })),
  };
}

/** Every day at or above the threshold, in order. */
export function findBursts(
  byDay: Map<string, number>,
  threshold: number = SEND_DETECTION_MIN_OPENS_PER_DAY
): OpenBurst[] {
  return [...byDay.entries()]
    .filter(([, opens]) => opens >= threshold)
    .map(([day, opens]) => ({ day, opens }));
}
