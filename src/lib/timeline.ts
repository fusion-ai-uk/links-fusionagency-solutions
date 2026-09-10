import { getCampaignDefinition } from "@/config/programmes";
import type { SendInfo } from "@/lib/confidence";
import {
  findBursts,
  SEND_DETECTION_MIN_OPENS_PER_DAY,
  type OpenBurst,
} from "@/lib/send-detection";
import {
  formatUkClock,
  formatUkDayShort,
  formatUkDayWithWeekday,
  formatUkTime,
  nextUkDay,
  ukDayAnchor,
  ukDayKey,
  ukDayStart,
  ukHourKey,
} from "@/lib/time";

/**
 * The timeline view model — one email's opens and clicks over time.
 *
 * Two series are prepared from the same events so the chart can switch
 * between them instantly:
 *   day   — every UK calendar day from the first activity (or the send) to the
 *           last activity, at least a week, at most 180 days
 *   hour  — the 72 UK clock hours around the send moment (or the first activity
 *           when no send is known), where the shape of the send is visible
 *
 * The events passed in are already classified and filtered by the chips, so
 * the bars agree with every other figure on the page. Bursts come from the
 * unfiltered non-bot opens, because they describe the data, not the view.
 */

export type Grain = "day" | "hour";

export interface TimelineBucket {
  key: string;
  /** Axis label — "10 Sep" or "11:00". */
  label: string;
  /** Tooltip heading — "Thu 10 Sep" or "Thu 10 Sep · 11:00–12:00". */
  title: string;
  /** ISO start of the bucket (day buckets: noon UTC anchor). */
  start: string;
  /** The instants this bucket spans, for the time-range brush. ISO, half-open. */
  rangeFrom: string;
  rangeTo: string;
  opens: number;
  clicks: number;
  /** This bucket contains the send moment. */
  isSend: boolean;
  /** Non-bot opens that day when the day cleared the threshold; null otherwise (day grain only). */
  burst: number | null;
  /** True when that burst sits before the send — a likely seed or test send. */
  burstBeforeSend: boolean;
}

/** A one-click time range, anchored on the send. ISO instants, half-open [from, to). */
export interface RangePreset {
  label: string;
  from: string;
  to: string;
}

export interface TimelineSeries {
  grain: Grain;
  buckets: TimelineBucket[];
  maxOpens: number;
  maxClicks: number;
  /** Events in the view that fall outside this series' range. */
  outsideRange: number;
  /** One line describing the range. */
  rangeText: string;
}

export interface TimelineSend {
  at: string;
  source: "config" | "detected";
  /** "10 Sep 2026 11:04:12 UK time". */
  text: string;
  /** "10 Sep" — for the chart label in day view. */
  dayText: string;
  /** "11:04" — for the chart label in hour view. */
  clockText: string;
  opensThatDay: number | null;
  /** Non-bot opens in the 24 hours from the send moment (detected sends only). */
  opensFirst24h: number | null;
}

export interface TimelineData {
  campaignId: string;
  label: string;
  send: TimelineSend | null;
  presets: RangePreset[];
  /** Days after the send that cleared the threshold again — a resend or a prefetch. */
  bursts: (OpenBurst & { label: string })[];
  /**
   * Days before the send that cleared the threshold but were dwarfed by the
   * send proper — most likely a seed list or a test to a small group.
   */
  preSendBursts: (OpenBurst & { label: string })[];
  threshold: number;
  totals: { opens: number; clicks: number };
  hasEvents: boolean;
  day: TimelineSeries;
  hour: TimelineSeries;
}

export interface TimelineEvent {
  eventType: string;
  createdAt: Date;
}

const HOUR_MS = 3_600_000;
const HOUR_BUCKETS = 72;
const HOURS_BEFORE_ANCHOR = 6;
const MIN_DAYS = 7;
const MAX_DAYS = 180;
const DAYS_AFTER_SEND = 14;

const floorToHour = (date: Date) => new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);

function daysBetween(a: string, b: string): number {
  return Math.round((ukDayAnchor(b).getTime() - ukDayAnchor(a).getTime()) / 86_400_000);
}

function addDays(dayKey: string, days: number): string {
  return ukDayKey(new Date(ukDayAnchor(dayKey).getTime() + days * 86_400_000));
}

function buildDaySeries(
  events: TimelineEvent[],
  send: SendInfo | null,
  bursts: (OpenBurst & { beforeSend: boolean })[],
  now: Date
): TimelineSeries {
  const today = ukDayKey(now);
  const sendDay = send ? ukDayKey(send.at) : null;
  const eventDays = events.map((e) => ukDayKey(e.createdAt)).sort();

  if (eventDays.length === 0 && !sendDay) {
    return { grain: "day", buckets: [], maxOpens: 0, maxClicks: 0, outsideRange: 0, rangeText: "" };
  }

  let start = eventDays[0] ?? sendDay!;
  let end = eventDays[eventDays.length - 1] ?? sendDay!;
  // Days that cleared the threshold must be on screen even when the chips
  // exclude their events — a passed-over day sits before the send, so without
  // this the flag explaining why the send moved would never be visible.
  for (const b of bursts) {
    if (b.day < start) start = b.day;
    if (b.day > end) end = b.day;
  }
  if (sendDay) {
    if (sendDay < start) start = sendDay;
    // Show the fortnight after the send even when activity has gone quiet.
    const afterSend = addDays(sendDay, DAYS_AFTER_SEND);
    const wanted = afterSend < today ? afterSend : today;
    if (wanted > end) end = wanted;
  }
  if (end > today) end = today;
  // At least a week on screen, preferring to extend towards today.
  while (daysBetween(start, end) + 1 < MIN_DAYS) {
    if (end < today) end = nextUkDay(end);
    else start = addDays(start, -1);
  }
  let truncated = false;
  if (daysBetween(start, end) + 1 > MAX_DAYS) {
    start = addDays(end, -(MAX_DAYS - 1));
    truncated = true;
  }

  const burstByDay = new Map(bursts.map((b) => [b.day, { opens: b.opens, beforeSend: b.beforeSend }]));
  const buckets: TimelineBucket[] = [];
  const index = new Map<string, number>();
  for (let key = start; key <= end; key = nextUkDay(key)) {
    index.set(key, buckets.length);
    buckets.push({
      key,
      label: formatUkDayShort(key),
      title: formatUkDayWithWeekday(key),
      start: ukDayAnchor(key).toISOString(),
      rangeFrom: ukDayStart(key).toISOString(),
      rangeTo: ukDayStart(nextUkDay(key)).toISOString(),
      opens: 0,
      clicks: 0,
      isSend: key === sendDay,
      burst: key !== sendDay ? burstByDay.get(key)?.opens ?? null : null,
      burstBeforeSend: key !== sendDay ? burstByDay.get(key)?.beforeSend ?? false : false,
    });
    if (buckets.length > MAX_DAYS) break;
  }

  let outsideRange = 0;
  for (const e of events) {
    const i = index.get(ukDayKey(e.createdAt));
    if (i === undefined) {
      outsideRange++;
      continue;
    }
    if (e.eventType === "click") buckets[i].clicks++;
    else buckets[i].opens++;
  }

  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  return {
    grain: "day",
    buckets,
    maxOpens: Math.max(0, ...buckets.map((b) => b.opens)),
    maxClicks: Math.max(0, ...buckets.map((b) => b.clicks)),
    outsideRange,
    rangeText: `${first.title} – ${last.title}, ${buckets.length} days${truncated ? " (the most recent 180)" : ""}`,
  };
}

function buildHourSeries(events: TimelineEvent[], send: SendInfo | null): TimelineSeries {
  const sorted = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const anchor = send?.at ?? sorted[0]?.createdAt ?? null;
  if (!anchor) {
    return { grain: "hour", buckets: [], maxOpens: 0, maxClicks: 0, outsideRange: 0, rangeText: "" };
  }

  const from = new Date(floorToHour(anchor).getTime() - HOURS_BEFORE_ANCHOR * HOUR_MS);
  const sendHour = send ? ukHourKey(send.at) : null;
  const buckets: TimelineBucket[] = [];
  const index = new Map<string, number>();
  for (let i = 0; i < HOUR_BUCKETS; i++) {
    const start = new Date(from.getTime() + i * HOUR_MS);
    const key = ukHourKey(start);
    // A repeated clock hour (autumn DST change) shares one bucket.
    if (index.has(key)) continue;
    index.set(key, buckets.length);
    const endClock = formatUkClock(new Date(start.getTime() + HOUR_MS));
    buckets.push({
      key,
      label: formatUkClock(start),
      title: `${formatUkDayWithWeekday(ukDayKey(start))} · ${formatUkClock(start)}–${endClock}`,
      start: start.toISOString(),
      rangeFrom: start.toISOString(),
      rangeTo: new Date(start.getTime() + HOUR_MS).toISOString(),
      opens: 0,
      clicks: 0,
      isSend: key === sendHour,
      burst: null,
      burstBeforeSend: false,
    });
  }

  let outsideRange = 0;
  for (const e of sorted) {
    const i = index.get(ukHourKey(e.createdAt));
    if (i === undefined) {
      outsideRange++;
      continue;
    }
    if (e.eventType === "click") buckets[i].clicks++;
    else buckets[i].opens++;
  }

  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  return {
    grain: "hour",
    buckets,
    maxOpens: Math.max(0, ...buckets.map((b) => b.opens)),
    maxClicks: Math.max(0, ...buckets.map((b) => b.clicks)),
    outsideRange,
    rangeText: `${first.title.replace(/–.*$/, "").trim()} – ${last.title.replace(/·.*·/, "·").trim()}, ${buckets.length} hours${send ? " around the send" : " from the first activity"}`,
  };
}

export function buildTimeline(options: {
  campaignId: string;
  label: string;
  /** Classified events for this email that the chips count. */
  events: TimelineEvent[];
  send: SendInfo | null;
  /** Non-bot opens per UK day on the live ID, regardless of chips. */
  opensByDay: Map<string, number> | undefined;
  now?: Date;
}): TimelineData {
  const now = options.now ?? new Date();
  const threshold =
    getCampaignDefinition(options.campaignId)?.detectSendAtOpens ?? SEND_DETECTION_MIN_OPENS_PER_DAY;
  const sendDay = options.send ? ukDayKey(options.send.at) : null;
  const withLabel = (b: OpenBurst) => ({ ...b, label: formatUkDayShort(b.day) });
  const qualifying = findBursts(options.opensByDay ?? new Map(), threshold).filter((b) => b.day !== sendDay);
  // Days the detector passed over sit before the send; anything after it is a
  // later burst. With a config send date there is nothing to have passed over,
  // so days before it are simply reported as bursts.
  const passedOver = new Set((options.send?.detected?.passedOver ?? []).map((b) => b.day));
  const bursts = qualifying.filter((b) => !passedOver.has(b.day)).map(withLabel);
  const preSendBursts = qualifying.filter((b) => passedOver.has(b.day)).map(withLabel);

  const send: TimelineSend | null = options.send
    ? {
        at: options.send.at.toISOString(),
        source: options.send.source,
        text: `${formatUkTime(options.send.at)} UK time`,
        dayText: formatUkDayShort(sendDay!),
        clockText: formatUkClock(options.send.at),
        opensThatDay: options.send.detected?.opensThatDay ?? options.opensByDay?.get(sendDay!) ?? null,
        opensFirst24h: options.send.detected?.opensFirst24h ?? null,
      }
    : null;

  let opens = 0;
  let clicks = 0;
  for (const e of options.events) {
    if (e.eventType === "click") clicks++;
    else opens++;
  }

  const presets: RangePreset[] = options.send
    ? [
        {
          label: "Send day",
          from: ukDayStart(sendDay!).toISOString(),
          to: ukDayStart(nextUkDay(sendDay!)).toISOString(),
        },
        { label: "First 72 h", from: options.send.at.toISOString(), to: new Date(options.send.at.getTime() + 72 * HOUR_MS).toISOString() },
        { label: "First 7 days", from: options.send.at.toISOString(), to: new Date(options.send.at.getTime() + 7 * 86_400_000).toISOString() },
      ]
    : [];

  return {
    campaignId: options.campaignId,
    label: options.label,
    send,
    presets,
    bursts,
    preSendBursts,
    threshold,
    totals: { opens, clicks },
    hasEvents: options.events.length > 0,
    day: buildDaySeries(
      options.events,
      options.send,
      [
        ...bursts.map((b) => ({ ...b, beforeSend: false })),
        ...preSendBursts.map((b) => ({ ...b, beforeSend: true })),
      ],
      now
    ),
    hour: buildHourSeries(options.events, options.send),
  };
}

/** A tidy axis maximum: 1, 2, 5 × 10ⁿ at or above the value (minimum 5). */
export function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 5, 10]) {
    if (value <= m * magnitude) return m * magnitude;
  }
  return 10 * magnitude;
}
