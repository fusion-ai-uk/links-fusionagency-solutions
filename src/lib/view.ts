import { baseCampaignId, isTestCampaignId } from "@/config/programmes";
import type { ConfidenceInput, ConfidenceResult, Assessed } from "@/lib/confidence";
import { countryKey, placeName, UNKNOWN_COUNTRY } from "@/lib/geo-names";

/**
 * The dashboard view model.
 *
 * Every event has exactly one CLASS, derived from its confidence assessment:
 *   test · presend · bot · internal · echo · repeat · confirmed
 *
 * The user chooses which classes count, optionally narrows to some emails,
 * some countries and a time range. Every figure on the page — totals,
 * approximate uniques, per-email and per-link counts, the recent list, the map
 * — is computed from that one choice, so the numbers always agree with each
 * other and with the controls that produced them.
 *
 * Each control's own counts are computed with every OTHER filter applied, so a
 * chip or a country shows what switching it on would add to the current view.
 */

export const EVENT_CLASSES = [
  "confirmed",
  "echo",
  "repeat",
  "internal",
  "bot",
  "presend",
  "test",
] as const;

export type EventClass = (typeof EVENT_CLASSES)[number];

/** What counts by default: every live event, nothing from before the send. */
export const LIVE_CLASSES: EventClass[] = ["confirmed", "echo", "repeat", "internal", "bot"];

export const PRESETS: Record<"live" | "confirmed" | "everything", EventClass[]> = {
  live: LIVE_CLASSES,
  confirmed: ["confirmed"],
  everything: [...EVENT_CLASSES],
};

export interface ClassMeta {
  label: string;
  /** One line for the chip tooltip. */
  short: string;
  /** CSS colour token for the chip when active. */
  colour: string;
  /** Icon name understood by <Icon />. */
  icon: string;
  /** Whether the class applies to opens as well as clicks. */
  opens: boolean;
}

export const CLASS_META: Record<EventClass, ClassMeta> = {
  confirmed: {
    label: "Confirmed",
    short: "Live events with nothing against them — a recipient engaging. The figure to report.",
    colour: "var(--accent-teal)",
    icon: "check",
    opens: true,
  },
  echo: {
    label: "Echo",
    short: "A second click on the same link within seconds from a different address — the signature of a link-protection scanner.",
    colour: "var(--accent-orange)",
    icon: "echo",
    opens: false,
  },
  repeat: {
    label: "Repeat",
    short: "The same address clicking the same link again within seconds.",
    colour: "var(--accent-violet)",
    icon: "repeat",
    opens: false,
  },
  internal: {
    label: "Internal",
    short: "A device that had produced test or pre-send events — most likely a colleague looking at the live email.",
    colour: "var(--accent-cyan)",
    icon: "user",
    opens: true,
  },
  bot: {
    label: "Bot",
    short: "User agent matched a scanner, proxy or automation pattern.",
    colour: "var(--text-tertiary)",
    icon: "bot",
    opens: true,
  },
  presend: {
    label: "Pre-send",
    short: "On the live URLs before the email was sent — testing, whichever URLs were used.",
    colour: "var(--accent-orange)",
    icon: "clock",
    opens: true,
  },
  test: {
    label: "Test",
    short: "On a -test campaign ID.",
    colour: "var(--accent-violet)",
    icon: "flask",
    opens: true,
  },
};

export function classOf(assessed: Assessed | undefined): EventClass {
  if (!assessed) return "confirmed";
  if (assessed.phase === "test") return "test";
  if (assessed.phase === "pre-send") return "presend";
  return assessed.reason ?? "confirmed";
}

/**
 * Parse the `include` query parameter, honouring the older toggles so that
 * links made before the chips existed keep meaning the same thing.
 */
export function parseClasses(params: {
  include?: string;
  bots?: string;
  tests?: string;
  collapse?: string;
}): EventClass[] {
  if (params.include !== undefined) {
    const wanted = params.include
      .split(",")
      .map((s) => s.trim())
      // "genuine" was the name for confirmed until September 2026.
      .map((s) => (s === "genuine" ? "confirmed" : s))
      .filter((s): s is EventClass => (EVENT_CLASSES as readonly string[]).includes(s));
    // An explicit empty selection is allowed: it shows zeros, honestly.
    return Array.from(new Set(wanted));
  }
  let classes = [...LIVE_CLASSES];
  if (params.bots === "exclude") classes = classes.filter((c) => c !== "bot");
  if (params.collapse === "1") classes = classes.filter((c) => c !== "echo" && c !== "repeat");
  if (params.tests === "include") classes = [...classes, "presend", "test"];
  return classes;
}

export function serializeClasses(classes: EventClass[]): string | null {
  const set = new Set(classes);
  const isDefault =
    set.size === LIVE_CLASSES.length && LIVE_CLASSES.every((c) => set.has(c));
  if (isDefault) return null;
  return EVENT_CLASSES.filter((c) => set.has(c)).join(",");
}

export function presetFor(classes: EventClass[]): keyof typeof PRESETS | null {
  const set = new Set(classes);
  for (const [name, list] of Object.entries(PRESETS) as [keyof typeof PRESETS, EventClass[]][]) {
    if (set.size === list.length && list.every((c) => set.has(c))) return name;
  }
  return null;
}

/** A half-open time window [from, to). Either side may be open. */
export interface TimeRange {
  from: Date | null;
  to: Date | null;
}

/** Parse `from`/`to` URL parameters (ISO 8601). Invalid or empty means no bound. */
export function parseRange(params: { from?: string; to?: string }): TimeRange | null {
  const parse = (v: string | undefined) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parse(params.from);
  const to = parse(params.to);
  if (!from && !to) return null;
  if (from && to && to <= from) return null;
  return { from, to };
}

export function inRange(range: TimeRange | null, at: Date): boolean {
  if (!range) return true;
  if (range.from && at < range.from) return false;
  if (range.to && at >= range.to) return false;
  return true;
}

export interface ClassCount {
  clicks: number;
  opens: number;
}

export interface CountryCount {
  /** ISO alpha-2, or "unknown". */
  code: string;
  opens: number;
  clicks: number;
  /** Distinct hashed IP + user agent. */
  devices: number;
}

export interface PlaceCount {
  country: string;
  region: string | null;
  city: string | null;
  opens: number;
  clicks: number;
}

export interface CampaignView {
  campaignId: string;
  opens: number;
  clicks: number;
  approxUniqueOpens: number;
  approxUniqueClicks: number;
  /** Counts per class within this email, regardless of selection. */
  byClass: Record<EventClass, ClassCount>;
}

export interface ViewEvent extends ConfidenceInput {
  class: EventClass;
  assessed: Assessed | undefined;
}

export interface DashboardView {
  /** Which classes are counted. */
  classes: Set<EventClass>;
  /** Selected email IDs (base IDs); empty means every email in scope. */
  selected: string[];
  /** Selected countries (codes or "unknown"); empty means everywhere. */
  countries: string[];
  range: TimeRange | null;
  totalOpens: number;
  totalClicks: number;
  approxUniqueOpens: number;
  approxUniqueClicks: number;
  /** Always the confirmed figures, whatever is selected — the reference point. */
  confirmedClicks: number;
  confirmedOpens: number;
  clicksByLink: { linkId: string; count: number }[];
  /** One entry per live campaign ID in scope, in the order given. */
  campaigns: CampaignView[];
  /** Latest events among those counted, newest first. */
  recent: ViewEvent[];
  /** Counts per class across the selection, with country and time applied. */
  classCounts: Record<EventClass, ClassCount>;
  /**
   * Counts per country across the selection, with classes and time applied
   * but NOT the country filter — this feeds the country picker and the map,
   * both of which need to show what is not selected too. Busiest first.
   */
  countryCounts: CountryCount[];
  /** Places within the selected countries (or everywhere), busiest first. */
  places: PlaceCount[];
  /** Events counted vs recorded, for the "showing X of Y" line. */
  counted: number;
  recorded: number;
}

const emptyClassCounts = (): Record<EventClass, ClassCount> =>
  Object.fromEntries(EVENT_CLASSES.map((c) => [c, { clicks: 0, opens: 0 }])) as Record<
    EventClass,
    ClassCount
  >;

const deviceKey = (e: { ipHash: string | null; userAgent: string | null }) =>
  `${e.ipHash ?? ""}|${e.userAgent ?? ""}`;

export function buildView(options: {
  events: ConfidenceInput[];
  confidence: ConfidenceResult;
  scopeCampaignIds: string[];
  selectedCampaignIds: string[];
  classes: EventClass[];
  countries?: string[];
  range?: TimeRange | null;
  recentLimit?: number;
  placeLimit?: number;
}): DashboardView {
  const { events, confidence, scopeCampaignIds, selectedCampaignIds } = options;
  const classes = new Set(options.classes);
  const selected = new Set(selectedCampaignIds);
  const countries = new Set(options.countries ?? []);
  const range = options.range ?? null;
  const recentLimit = options.recentLimit ?? 50;
  const placeLimit = options.placeLimit ?? 40;

  const inSelection = (campaignId: string | null) =>
    selected.size === 0 || selected.has(baseCampaignId(campaignId ?? "unknown"));
  const inCountries = (code: string) => countries.size === 0 || countries.has(code);

  const classified: ViewEvent[] = events.map((e) => {
    const assessed = confidence.byId.get(e.id);
    return { ...e, class: classOf(assessed), assessed };
  });

  // Per-email view: every email in scope, all classes tallied, selection applied to totals.
  const perCampaign = new Map<string, CampaignView>();
  for (const id of scopeCampaignIds) {
    perCampaign.set(id, {
      campaignId: id,
      opens: 0,
      clicks: 0,
      approxUniqueOpens: 0,
      approxUniqueClicks: 0,
      byClass: emptyClassCounts(),
    });
  }
  const campaignDevices = new Map<string, { opens: Set<string>; clicks: Set<string> }>();

  const classCounts = emptyClassCounts();
  const countryTallies = new Map<string, { opens: number; clicks: number; devices: Set<string> }>();
  const placeTallies = new Map<string, PlaceCount>();
  const clickDevices = new Set<string>();
  const openDevices = new Set<string>();
  const perLink = new Map<string, number>();
  let totalOpens = 0;
  let totalClicks = 0;
  let confirmedClicks = 0;
  let confirmedOpens = 0;
  let counted = 0;
  let recorded = 0;
  const recent: ViewEvent[] = [];

  for (const e of classified) {
    const base = baseCampaignId(e.campaignId ?? "unknown");
    const isClick = e.eventType === "click";
    const cv = perCampaign.get(base);
    const code = countryKey(e.ipCountry);
    const classOk = classes.has(e.class);
    const rangeOk = inRange(range, e.createdAt);
    const countryOk = inCountries(code);

    // Per-email rows follow the chips, countries and time but not the
    // selection: the table is the stable reference, while the headline
    // figures narrow to what is selected.
    if (cv) {
      const bucket = cv.byClass[e.class];
      if (rangeOk && countryOk) {
        if (isClick) bucket.clicks++;
        else bucket.opens++;
      }
      if (classOk && rangeOk && countryOk) {
        if (isClick) cv.clicks++;
        else cv.opens++;
        const devices =
          campaignDevices.get(base) ?? { opens: new Set<string>(), clicks: new Set<string>() };
        (isClick ? devices.clicks : devices.opens).add(deviceKey(e));
        campaignDevices.set(base, devices);
      }
    }

    if (!inSelection(e.campaignId)) continue;
    recorded++;

    // Each control shows what it would add given the others.
    if (rangeOk && countryOk) {
      if (isClick) classCounts[e.class].clicks++;
      else classCounts[e.class].opens++;
    }
    if (classOk && rangeOk) {
      const tally = countryTallies.get(code) ?? { opens: 0, clicks: 0, devices: new Set<string>() };
      if (isClick) tally.clicks++;
      else tally.opens++;
      tally.devices.add(deviceKey(e));
      countryTallies.set(code, tally);
    }

    if (e.class === "confirmed" && rangeOk && countryOk) {
      if (isClick) confirmedClicks++;
      else confirmedOpens++;
    }

    if (!classOk || !rangeOk || !countryOk) continue;
    counted++;

    if (isClick) {
      totalClicks++;
      clickDevices.add(deviceKey(e));
      if (e.linkId) perLink.set(e.linkId, (perLink.get(e.linkId) ?? 0) + 1);
    } else {
      totalOpens++;
      openDevices.add(deviceKey(e));
    }

    const placeKey = `${code}|${e.ipRegion ?? ""}|${e.ipCity ?? ""}`;
    const place =
      placeTallies.get(placeKey) ??
      { country: code, region: placeName(e.ipRegion), city: placeName(e.ipCity), opens: 0, clicks: 0 };
    if (isClick) place.clicks++;
    else place.opens++;
    placeTallies.set(placeKey, place);

    recent.push(e);
  }

  for (const [id, cv] of perCampaign) {
    const devices = campaignDevices.get(id);
    cv.approxUniqueOpens = devices?.opens.size ?? 0;
    cv.approxUniqueClicks = devices?.clicks.size ?? 0;
  }

  recent.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const byVolume = <T extends { opens: number; clicks: number }>(a: T, b: T) =>
    b.opens + b.clicks - (a.opens + a.clicks) || b.clicks - a.clicks;

  const countryCounts: CountryCount[] = [...countryTallies.entries()]
    .map(([code, t]) => ({ code, opens: t.opens, clicks: t.clicks, devices: t.devices.size }))
    .sort((a, b) => byVolume(a, b) || (a.code === UNKNOWN_COUNTRY ? 1 : b.code === UNKNOWN_COUNTRY ? -1 : a.code.localeCompare(b.code)));

  return {
    classes,
    selected: selectedCampaignIds,
    countries: [...countries],
    range,
    totalOpens,
    totalClicks,
    approxUniqueOpens: openDevices.size,
    approxUniqueClicks: clickDevices.size,
    confirmedClicks,
    confirmedOpens,
    clicksByLink: [...perLink.entries()]
      .map(([linkId, count]) => ({ linkId, count }))
      .sort((a, b) => b.count - a.count),
    campaigns: [...perCampaign.values()],
    recent: recent.slice(0, recentLimit),
    classCounts,
    countryCounts,
    places: [...placeTallies.values()].sort(byVolume).slice(0, placeLimit),
    counted,
    recorded,
  };
}

/** Human summary of what is counted, for the mono line under the controls. */
export function describeClasses(classes: EventClass[]): string {
  const preset = presetFor(classes);
  if (preset === "live") return "all live activity";
  if (preset === "confirmed") return "confirmed only";
  if (preset === "everything") return "everything, including test and pre-send";
  if (classes.length === 0) return "nothing selected";
  return classes.map((c) => CLASS_META[c].label.toLowerCase()).join(" + ");
}

export { isTestCampaignId };
