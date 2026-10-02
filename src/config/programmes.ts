/**
 * Programme registry — the top level of the tracking hierarchy.
 *
 *   Programme (client + brand)  ->  Campaign / wave (one email = one `cid`)
 *
 * Campaign IDs here MUST match the `cid` values used in the email HTML and the
 * keys in `campaignLinkDestinations` (src/config/links.ts). This file adds the
 * human context around a `cid`: which client it belongs to, where it is in the
 * approval process, and when it is due to send.
 *
 * Statuses are maintained by hand — flip a campaign's status as it moves through
 * review, then commit and redeploy.
 */

export type CampaignStatus =
  /** Slot reserved. Content/HTML not received yet — nothing to configure. */
  | "planned"
  /** Content received but still in client / medical / legal review. */
  | "in-review"
  /** Tracking configured and handed over to the email build. Not sent yet. */
  | "ready"
  /** Sent — collecting live data. */
  | "sent"
  /** Send finished and reporting signed off. */
  | "closed";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planned: "Planned",
  "in-review": "In review",
  ready: "Ready to send",
  sent: "Sent",
  closed: "Closed",
};

export interface CampaignDefinition {
  /** The `cid` used in /o and /c tracking URLs. */
  id: string;
  label: string;
  status: CampaignStatus;
  /** Planned transmission date, DD Month YYYY. null while TBC. */
  sendDate: string | null;
  /**
   * When the live send began, ISO 8601 with offset — e.g.
   * "2026-09-10T09:00:00+01:00". Events on the live campaign ID before this
   * moment are pre-send activity (the build team checking links), not data.
   * Set it when the status moves to "sent". Leave unset on historic sends that
   * predate this rule; everything on them counts.
   */
  liveFrom?: string | null;
  /**
   * Opens in one UK day that mark the send as having happened, when the status
   * has not yet been moved to "sent". Defaults to SEND_DETECTION_MIN_OPENS_PER_DAY
   * (50). Lower it for a small audience.
   */
  detectSendAtOpens?: number;
  notes?: string;
}

/**
 * Which events on a live campaign ID count as live.
 *   null            — no restriction (unknown cid, a test cid, or a historic
 *                     send with no liveFrom recorded)
 *   { from: null }  — nothing counts yet: the email has not been sent
 *   { from: Date }  — only events at or after this moment count
 */
export interface LiveWindow {
  campaignId: string;
  from: Date | null;
}

export function getLiveWindow(campaignId: string): LiveWindow | null {
  if (isTestCampaignId(campaignId)) return null;
  const definition = getCampaignDefinition(campaignId);
  if (!definition) return null;

  const sent = definition.status === "sent" || definition.status === "closed";
  if (!sent) return { campaignId, from: null };
  if (!definition.liveFrom) return null;

  const from = new Date(definition.liveFrom);
  return Number.isNaN(from.getTime()) ? null : { campaignId, from };
}

/** Live windows for every campaign in a list that has one. */
export function getLiveWindows(campaignIds: string[]): LiveWindow[] {
  return campaignIds
    .map(getLiveWindow)
    .filter((w): w is LiveWindow => w !== null);
}

export interface Programme {
  id: string;
  label: string;
  client: string;
  brand: string;
  description?: string;
  campaigns: CampaignDefinition[];
}

/** Suffix that turns any campaign ID into its throwaway test twin. */
export const TEST_CAMPAIGN_SUFFIX = "-test";

/** Bucket for campaign IDs found in the database but not defined below. */
export const UNASSIGNED_PROGRAMME_ID = "unassigned";

export const PROGRAMMES: Programme[] = [
  {
    id: "gilead-ambisome",
    label: "Gilead AmBisome",
    client: "IMI",
    brand: "AmBisome",
    description:
      "Five-email programme sent via IMI. No recipient IDs or merge tags are " +
      "provided, so tracking is campaign-level only. Emails are configured " +
      "one at a time as each approved HTML lands.",
    campaigns: [
      {
        id: "gilead-ambisome-email-1",
        label: "AmBisome Email 1 (Fungi Now wave 1)",
        status: "ready",
        sendDate: "September 2026",
        notes:
          "Fungi Now episode 1. Two CTAs to the touchinfectiousdiseases.com episode page, one to the Lancet Microbe paper.",
      },
      {
        id: "gilead-ambisome-email-2",
        label: "AmBisome Email 2 (Fungi Now wave 2)",
        status: "ready",
        sendDate: null,
        notes:
          "Stepwise guide: ECMM guideline for the management of invasive " +
          "candidiasis. Three CTAs across two destinations: the Episode 2 " +
          "thumbnail and the Watch Episode 2 button both go to the Fungi Now " +
          "learning zone, and Read the full publication goes to the ECMM " +
          "guideline in Lancet Infectious Diseases. Build file Fungi Now " +
          "Wave 2.html, job code GFM-UNB-2860. Open query: the Episode 2 " +
          "video_id is identical to Episode 1's, so the buttons may open the " +
          "wrong film — raised with the build team, set as built meanwhile.",
      },
      {
        id: "gilead-ambisome-email-3",
        label: "AmBisome Email 3",
        status: "planned",
        sendDate: null,
        notes: "Awaiting approved HTML and destination URLs.",
      },
      {
        id: "gilead-ambisome-email-4",
        label: "AmBisome Email 4",
        status: "planned",
        sendDate: null,
        notes: "Awaiting approved HTML and destination URLs.",
      },
      {
        id: "gilead-ambisome-email-5",
        label: "AmBisome Email 5",
        status: "planned",
        sendDate: null,
        notes: "Awaiting approved HTML and destination URLs.",
      },
    ],
  },
  {
    id: "gilead-veklury",
    label: "Gilead Veklury",
    client: "IMI",
    brand: "Veklury",
    description:
      "Programme sent via IMI, set up with Steve and Bryony. Campaign-level " +
      "only — no recipient IDs or merge tags. Wave 1 is the whitepaper email; " +
      "the wave 4b webinar email is tracked separately under its own ID.",
    campaigns: [
      {
        id: "gilead-veklury-wave-1-whitepaper",
        label: "Veklury Wave 1 — Whitepaper",
        status: "in-review",
        sendDate: null,
        notes:
          "COVID-19 hasn't gone away. Three CTAs across two destinations: the " +
          "WATCH NOW button and the video still itself both go to the ESCMID " +
          "2025 symposium highlights, and a download of the Grayling COVID " +
          "policy paper. The image link was added on 1 October 2026 at Steve's " +
          "request and keeps its own link ID so the two placements report " +
          "separately. Destinations came from the build. Build file " +
          "Wave_1_Whitepaper, job code GFM-VKY-0091, October 2026.",
      },
      {
        id: "gilead-veklury-email-1",
        // Kept under its original ID: the links are already built into that
        // email, so renaming it would break them. The label carries the truth.
        label: "Veklury Webinar Email (wave 4b)",
        status: "ready",
        sendDate: "September 2026",
        notes:
          "COVID-19 in clinical practice webinar. Three image CTAs to the same touchinfectiousdiseases.com page.",
      },
      {
        id: "gilead-veklury-email-2",
        label: "Veklury Email 2",
        status: "planned",
        sendDate: null,
        notes: "Awaiting HTML and destination URLs.",
      },
      {
        id: "gilead-veklury-email-3",
        label: "Veklury Email 3",
        status: "planned",
        sendDate: null,
        notes: "Awaiting HTML and destination URLs.",
      },
      {
        id: "gilead-veklury-email-4",
        label: "Veklury Email 4",
        status: "planned",
        sendDate: null,
        notes: "Awaiting HTML and destination URLs.",
      },
      {
        id: "gilead-veklury-email-5",
        label: "Veklury Email 5",
        status: "planned",
        sendDate: null,
        notes: "Awaiting HTML and destination URLs.",
      },
    ],
  },
  {
    id: "imi-aids2026",
    label: "IMI — Gilead AIDS 2026",
    client: "IMI",
    brand: "Gilead AIDS 2026",
    description: "Congress programme hosted on hosted.bmj.com/gilead-aids2026.",
    campaigns: [
      {
        id: "imi-aids2026-pre-email-jun-2026",
        label: "AIDS 2026 Pre-email",
        status: "sent",
        sendDate: "June 2026",
        // Predates the pre-send rule: everything on the live ID counts.
        liveFrom: null,
      },
      {
        id: "imi-aids2026-post-congress-jul-2026",
        label: "AIDS 2026 Post-congress",
        status: "sent",
        sendDate: "July 2026",
        // Predates the pre-send rule: everything on the live ID counts.
        liveFrom: null,
      },
      {
        id: "imi-aids2026-wave-3",
        label: "AIDS 2026 Wave 3",
        status: "planned",
        sendDate: null,
        notes: "Placeholder — no link IDs configured yet.",
      },
    ],
  },
  {
    id: "imi-hivglasgow",
    label: "IMI — Gilead HIV Glasgow",
    client: "IMI",
    brand: "Gilead HIV Glasgow",
    description:
      "HIV Glasgow 2026. Gilead-sponsored symposia — Ageing well with HIV " +
      "(Sunday 8 November) and The Prevention Paradox (Monday 9 November) — " +
      "plus the Booth 801 theatre programme. Campaign-level only: no recipient " +
      "IDs or merge tags are provided.",
    campaigns: [
      {
        id: "imi-hivglasgow-pre-email-2026",
        label: "HIV Glasgow Pre-email",
        status: "in-review",
        sendDate: null,
        notes:
          "Four CTAs: the header banner, Read more on each of the two symposia, " +
          "and Learn more on the Booth 801 talks. All four are live and tracking, " +
          "pointing at hosted.bmj.com/gilead-glasgow2026 as confirmed by Steve on " +
          "30 September 2026. That page was not yet published when it was set, so " +
          "check it resolves before the send. Build file index 3.html, prepared " +
          "September 2026, job code GFM-UNB-3012.",
      },
    ],
  },
  {
    id: "imi-lyvdelzi",
    label: "IMI — Gilead Lyvdelzi",
    client: "IMI",
    brand: "Gilead Lyvdelzi",
    description: "Hosted on hosted.bmj.com/gilead-lyvdelzi.",
    campaigns: [
      {
        id: "imi-lyvdelzi-may-2026",
        label: "Lyvdelzi May 2026",
        status: "sent",
        sendDate: "May 2026",
        // Predates the pre-send rule: everything on the live ID counts.
        liveFrom: null,
      },
    ],
  },
  {
    id: "takeda-sleep-academy",
    label: "Takeda Sleep Academy",
    client: "IMI",
    brand: "Takeda Sleep Academy",
    description:
      "Narcolepsy education programme for the Takeda Sleep Academy webinar " +
      "series, sent via IMI. Three waves, each with the same three CTAs: two " +
      "webinar registration buttons and a Join the Sleep Academy button. " +
      "Campaign-level only — no recipient IDs or merge tags. Destinations are " +
      "on cloud.takeda-uk.com and carry Takeda's own Matomo campaign " +
      "parameters, which differ per wave and must be preserved exactly.",
    campaigns: [
      {
        id: "takeda-sleep-academy-wave-1",
        label: "Sleep Academy Wave 1 — Webinar programme",
        status: "ready",
        sendDate: null,
        notes:
          "Subject theme: the webinar programme. CTAs: two REGISTER FOR THE " +
          "EXPERT-LED WEBINARS buttons and JOIN THE SLEEP ACADEMY. Build file " +
          "Sleep Academy Wave 1 v2.html. Note the Outlook-only VML button on " +
          "the Join CTA points at the webinar page with no Matomo parameters " +
          "— flagged to the build team.",
      },
      {
        id: "takeda-sleep-academy-wave-2",
        label: "Sleep Academy Wave 2 — The Excessively Sleepy Patient",
        status: "ready",
        sendDate: null,
        notes:
          "CTAs: REGISTER FOR THE FREE WEBINAR, REGISTER HERE, and JOIN THE " +
          "SLEEP ACADEMY. Build file Sleep_Academy_Wave_2 v2.html.",
      },
      {
        id: "takeda-sleep-academy-wave-3",
        label: "Sleep Academy Wave 3 — Excessive daytime sleepiness",
        status: "ready",
        sendDate: null,
        notes:
          "CTAs: two SECURE YOUR PLACE HERE buttons and JOIN THE SLEEP " +
          "ACADEMY. Build file Sleep_Academy_Wave_3 v2.html. The Join CTA's " +
          "mtm_source is empty in the build where waves 1 and 2 send " +
          "'thirdparty'; preserved as built and flagged to the build team.",
      },
    ],
  },
];

/** True when the ID is a `-test` twin rather than a live send. */
export function isTestCampaignId(campaignId: string): boolean {
  return campaignId.endsWith(TEST_CAMPAIGN_SUFFIX);
}

/** Strip the `-test` suffix so a test cid resolves to its parent campaign. */
export function baseCampaignId(campaignId: string): string {
  return isTestCampaignId(campaignId)
    ? campaignId.slice(0, -TEST_CAMPAIGN_SUFFIX.length)
    : campaignId;
}

export function getTestCampaignId(campaignId: string): string {
  return `${baseCampaignId(campaignId)}${TEST_CAMPAIGN_SUFFIX}`;
}

/** All campaigns across every programme, in registry order. */
export function getAllCampaigns(): CampaignDefinition[] {
  return PROGRAMMES.flatMap((programme) => programme.campaigns);
}

export function getProgrammeById(programmeId: string): Programme | null {
  return PROGRAMMES.find((programme) => programme.id === programmeId) ?? null;
}

/** Find the campaign definition for a `cid` (test twins resolve to the parent). */
export function getCampaignDefinition(
  campaignId: string
): CampaignDefinition | null {
  const base = baseCampaignId(campaignId);
  return getAllCampaigns().find((campaign) => campaign.id === base) ?? null;
}

/** Find the programme that owns a `cid` (test twins resolve to the parent). */
export function getProgrammeForCampaign(campaignId: string): Programme | null {
  const base = baseCampaignId(campaignId);
  return (
    PROGRAMMES.find((programme) =>
      programme.campaigns.some((campaign) => campaign.id === base)
    ) ?? null
  );
}

/** True when the `cid` is defined in this registry. */
export function isKnownCampaignId(campaignId: string): boolean {
  return getCampaignDefinition(campaignId) !== null;
}

/**
 * Campaign IDs seen in the database that no programme claims — typos, legacy
 * sends, or `unknown` from a pixel called without a `cid`.
 */
export function getUnassignedCampaignIds(
  existingCampaignIds: string[]
): string[] {
  return existingCampaignIds
    .filter((id) => !isKnownCampaignId(id))
    .sort((a, b) => a.localeCompare(b));
}
