import { ukDayKey } from "@/lib/time";

/**
 * Send detection — catching the moment an email actually went out.
 *
 * Nobody tells this system when a send happens; the status in config is set
 * by hand, often later. But a send is unmistakable in the data: opens on the
 * live campaign ID jump from a handful a day (the build team checking links)
 * to dozens or hundreds within an hour.
 *
 * Rule: the first UK calendar day with at least THRESHOLD non-bot opens on the
 * live campaign ID is the send day. Within that day, the send moment is the
 * start of the first burst — the earliest open that is followed by enough
 * further opens within half an hour. Everything before that moment on the live
 * ID is pre-send (testing); everything from it is live.
 *
 * The detected moment is used only while config has no better answer, i.e.
 * the campaign is not yet marked "sent". Recording `liveFrom` in config
 * confirms it and takes over.
 *
 * Any later day that clears the threshold again is reported as a burst: a
 * likely resend, a follow-up, or a mail provider pre-fetching images en masse.
 * It is shown, not acted on.
 */

export const SEND_DETECTION_MIN_OPENS_PER_DAY = 50;
/** Opens that must follow the first one within BURST_WINDOW_MS to mark the start. */
const BURST_WINDOW_MS = 30 * 60_000;

export interface OpenSample {
  createdAt: Date;
  isBot: boolean;
}

export interface DetectedSend {
  /** The moment the send began — the effective live-from. */
  at: Date;
  /** UK day key (YYYY-MM-DD) of the send. */
  day: string;
  opensThatDay: number;
  threshold: number;
}

export interface OpenBurst {
  day: string;
  opens: number;
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

/**
 * Detect the send from the opens recorded on one live campaign ID.
 * Returns null while no day has reached the threshold.
 */
export function detectSend(
  opens: OpenSample[],
  threshold: number = SEND_DETECTION_MIN_OPENS_PER_DAY
): DetectedSend | null {
  const byDay = countOpensByUkDay(opens);
  for (const [day, count] of byDay) {
    if (count < threshold) continue;
    const dayOpens = opens
      .filter((o) => !o.isBot && ukDayKey(o.createdAt) === day)
      .map((o) => o.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const at = burstStart(dayOpens, threshold) ?? dayOpens[0];
    return { at, day, opensThatDay: count, threshold };
  }
  return null;
}

/** Every day at or above the threshold, in order; the first is the send day. */
export function findBursts(
  byDay: Map<string, number>,
  threshold: number = SEND_DETECTION_MIN_OPENS_PER_DAY
): OpenBurst[] {
  return [...byDay.entries()]
    .filter(([, opens]) => opens >= threshold)
    .map(([day, opens]) => ({ day, opens }));
}
