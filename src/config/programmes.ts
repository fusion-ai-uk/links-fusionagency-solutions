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
  notes?: string;
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
      "provided, so tracking is campaign-level only. All five HTMLs are in " +
      "approval — link IDs and destinations are deliberately left empty until " +
      "each final HTML lands.",
    campaigns: [
      {
        id: "gilead-ambisome-email-1",
        label: "AmBisome Email 1",
        status: "planned",
        sendDate: null,
        notes: "Awaiting approved HTML and destination URLs.",
      },
      {
        id: "gilead-ambisome-email-2",
        label: "AmBisome Email 2",
        status: "planned",
        sendDate: null,
        notes: "Awaiting approved HTML and destination URLs.",
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
      "Five-email programme sent via IMI, set up with Steve and Bryony. " +
      "Campaign-level only — no recipient IDs or merge tags. Email 1 is the " +
      "COVID-19 webinar email (build file wave_4b).",
    campaigns: [
      {
        id: "gilead-veklury-email-1",
        label: "Veklury Email 1 (wave 4b)",
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
      },
      {
        id: "imi-aids2026-post-congress-jul-2026",
        label: "AIDS 2026 Post-congress",
        status: "sent",
        sendDate: "July 2026",
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
