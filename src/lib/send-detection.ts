import { ukDayAnchor, ukDayKey } from "@/lib/time";

/**
 * Send detection — catching the moment an email actually went out.
 *
 * Nobody tells this system when a send happens; the status in config is set
 * by hand, often later. But a send is unmistakable in the data: opens on the
 * live campaign ID jump from a handful a day (the build team checking links,
 * or a seed list) to hundreds within an hour.
 *
 * Two rules pick the send day:
 *
 *   1. VOLUME FLOOR. Only a UK calendar day with at least THRESHOLD non-bot
 *      opens (50 by default) can be a send day. The pre-send trickle never
 *      qualifies, however long it goes on.
 *
 *   2. SHARE OF THE PEAK. A day that clears the floor but is dwarfed by a day
 *      near it was not the send — it is a seed list, a test to a small group,
 *      or a false start. The send is the EARLIEST qualifying day holding at
 *      least SEND_SHARE_OF_PEAK_DAY (a third) of the busiest day around it.
 *      57 opens beside a 600-open day is 9%, so it is passed over; 800 beside
 *      1,200 is 67%, so the 800 day is the send and the 1,200 is simply the
 *      normal day-after peak.
 *
 * Days are compared on their CALENDAR-DAY totals — the way a person reads the
 * chart. An earlier attempt compared a rolling 24 hours from each day's burst
 * start, which let a late-afternoon test send borrow the following morning's
 * surge and win. The cost of using calendar days is that a send going out very
 * late in the evening, whose opens mostly land the next morning, is dated to
 * that next day; recording `liveFrom` in config fixes such a case exactly.
 *
 * Within the chosen day, the send moment is the start of the first burst — the
 * earliest open followed by enough further opens within half an hour.
 * Everything before that moment on the live ID is pre-send (testing);
 * everything from it is live.
 *
 * The result is recomputed on every load, so it recalibrates as data arrives.
 * It is used only while config has no better answer, i.e. the campaign is not
 * yet marked "sent". Recording `liveFrom` in config takes over.
 */

export const SEND_DETECTION_MIN_OPENS_PER_DAY = 50;
/** A qualifying day must hold at least this share of the peak day to be the send. */
export const SEND_SHARE_OF_PEAK_DAY = 1 / 3;
/** Qualifying days within this many days of a candidate are compared with it. */
export const SEND_COMPARISON_DAYS = 7;
/** How far ahead to look for the peak a candidate is measured against. */
export const SEND_PEAK_SCOPE_DAYS = 14;
/** Opens that must follow the first one within BURST_WINDOW_MS to mark the start. */
const BURST_WINDOW_MS = 30 * 60_000;
const DAY_MS = 86_400_000;

/**
 * A day counts as a burst when it rises to this multiple of the recent
 * baseline — the median of the three days before it. A send's own decay never
 * rises, so the tail after a send is not flagged; a resend or a mass
 * image-prefetch a week later is.
 */
export const BURST_RISE_FACTOR = 3;
const BURST_BASELINE_DAYS = 3;

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
  /** Non-bot opens on the send's own UK calendar day — the figure days were compared on. */
  opensThatDay: number;
  /** Non-bot opens in the 24 hours from the send moment, for information. */
  opensFirst24h: number;
  /** The busiest day the send day was compared against. */
  peakOpens: number;
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

const dayTime = (day: string) => ukDayAnchor(day).getTime();
const addDays = (day: string, days: number) => dayTime(day) + days * DAY_MS;

/**
 * Detect the send from the opens recorded on one live campaign ID.
 * Returns null while no day has reached the threshold.
 */
export function detectSend(
  opens: OpenSample[],
  threshold: number = SEND_DETECTION_MIN_OPENS_PER_DAY
): DetectedSend | null {
  const byDay = countOpensByUkDay(opens);
  const candidates = [...byDay.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([day, opens]) => ({ day, opens }));
  if (candidates.length === 0) return null;

  // Walk the qualifying days. A day is the send if it holds its own against
  // the busiest day nearby; otherwise it was a seed or a test and we move on.
  let chosen = candidates[candidates.length - 1];
  let peakOpens = chosen.opens;
  for (let i = 0; i < candidates.length; i++) {
    const anchor = candidates[i].day;
    const scope = candidates.filter(
      (c) => dayTime(c.day) >= dayTime(anchor) && dayTime(c.day) < addDays(anchor, SEND_PEAK_SCOPE_DAYS)
    );
    const peak = Math.max(...scope.map((c) => c.opens));
    const nearby = scope.filter((c) => dayTime(c.day) < addDays(anchor, SEND_COMPARISON_DAYS));
    const found = nearby.find((c) => c.opens >= SEND_SHARE_OF_PEAK_DAY * peak);
    if (found) {
      chosen = found;
      peakOpens = peak;
      break;
    }
  }

  const dayOpens = opens
    .filter((o) => !o.isBot && ukDayKey(o.createdAt) === chosen.day)
    .map((o) => o.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());
  const at = burstStart(dayOpens, threshold) ?? dayOpens[0];
  const end = at.getTime() + DAY_MS;
  const opensFirst24h = opens.filter((o) => !o.isBot && o.createdAt >= at && o.createdAt.getTime() < end).length;

  return {
    at,
    day: chosen.day,
    opensThatDay: chosen.opens,
    opensFirst24h,
    peakOpens,
    threshold,
    passedOver: candidates.filter((c) => c.day < chosen.day),
  };
}

/** Qualifying days before the send — a seed list, a test, or a false start. */
export function findPreSendDays(
  byDay: Map<string, number>,
  sendDay: string | null,
  threshold: number = SEND_DETECTION_MIN_OPENS_PER_DAY
): OpenBurst[] {
  return [...byDay.entries()]
    .filter(([day, opens]) => opens >= threshold && sendDay !== null && day < sendDay)
    .map(([day, opens]) => ({ day, opens }));
}

/**
 * Bursts: days after the send when opens rise sharply against the trend.
 *
 * A send decays — hundreds, then dozens, then a trickle — and none of that is
 * a burst, however far above the floor it sits. A burst is a return: at least
 * BURST_RISE_FACTOR times the median of the three days before it, above the
 * floor, and higher than the day before. That is a resend, a reminder, or a
 * mail provider pre-fetching images for a batch of inboxes at once.
 */
export function findBursts(
  byDay: Map<string, number>,
  sendDay: string | null,
  threshold: number = SEND_DETECTION_MIN_OPENS_PER_DAY
): OpenBurst[] {
  const days = [...byDay.keys()];
  if (days.length === 0) return [];
  const opensOn = (day: string) => byDay.get(day) ?? 0;

  const bursts: OpenBurst[] = [];
  for (const day of days) {
    const opens = opensOn(day);
    if (opens < threshold) continue;
    // Before the send is pre-send activity, reported separately; the send day
    // itself is the send, not a burst.
    if (sendDay !== null && day <= sendDay) continue;

    const previous: number[] = [];
    for (let back = 1; back <= BURST_BASELINE_DAYS; back++) {
      previous.push(opensOn(ukDayKey(new Date(addDays(day, -back)))));
    }
    const sorted = [...previous].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // The day before matters as much as the median: on the day after a send
    // the two days before that are empty, which would drag a median to zero
    // and make the entirely normal day-after peak look like a burst.
    const baseline = Math.max(previous[0], median);
    const rising = opens > previous[0];
    if (rising && opens >= BURST_RISE_FACTOR * baseline) {
      bursts.push({ day, opens });
    }
  }
  return bursts;
}
