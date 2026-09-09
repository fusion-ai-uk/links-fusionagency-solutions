import { baseCampaignId, isTestCampaignId } from "@/config/programmes";
import type { ConfidenceInput, ConfidenceResult, Assessed } from "@/lib/confidence";

/**
 * The dashboard view model.
 *
 * Every event has exactly one CLASS, derived from its confidence assessment:
 *   test · presend · bot · internal · echo · repeat · confirmed
 *
 * The user chooses which classes count. Every figure on the page — totals,
 * approximate uniques, per-email and per-link counts, the recent list — is
 * computed from that choice alone, so the numbers always agree with each other
 * and with the chips that produced them. "Collapse echoes" is simply the
 * choice to leave echo and repeat out.
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

export interface ClassCount {
  clicks: number;
  opens: number;
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
  /** Counts per class across the selection, regardless of which are counted. */
  classCounts: Record<EventClass, ClassCount>;
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
  recentLimit?: number;
}): DashboardView {
  const { events, confidence, scopeCampaignIds, selectedCampaignIds } = options;
  const classes = new Set(options.classes);
  const selected = new Set(selectedCampaignIds);
  const recentLimit = options.recentLimit ?? 50;

  const inSelection = (campaignId: string | null) =>
    selected.size === 0 || selected.has(baseCampaignId(campaignId ?? "unknown"));

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

    // Per-email rows follow the chips but not the selection: the table is the
    // stable reference, while the headline figures narrow to what is selected.
    if (cv) {
      const bucket = cv.byClass[e.class];
      if (isClick) bucket.clicks++;
      else bucket.opens++;

      if (classes.has(e.class)) {
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

    // Class counts across the selection, so chips can show what each would add.
    if (isClick) classCounts[e.class].clicks++;
    else classCounts[e.class].opens++;

    if (e.class === "confirmed") {
      if (isClick) confirmedClicks++;
      else confirmedOpens++;
    }

    if (!classes.has(e.class)) continue;
    counted++;

    if (isClick) {
      totalClicks++;
      clickDevices.add(deviceKey(e));
      if (e.linkId) perLink.set(e.linkId, (perLink.get(e.linkId) ?? 0) + 1);
    } else {
      totalOpens++;
      openDevices.add(deviceKey(e));
    }

    recent.push(e);
  }

  for (const [id, cv] of perCampaign) {
    const devices = campaignDevices.get(id);
    cv.approxUniqueOpens = devices?.opens.size ?? 0;
    cv.approxUniqueClicks = devices?.clicks.size ?? 0;
  }

  recent.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    classes,
    selected: selectedCampaignIds,
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
