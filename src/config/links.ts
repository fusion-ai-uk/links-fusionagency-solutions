/**
 * Allowlisted click-tracking destinations.
 *
 * - Campaign-specific maps let us run concurrent email waves safely.
 * - Arbitrary destination URLs from query strings are NEVER accepted.
 * - `-test` campaign IDs resolve to their parent campaign's map, so test sends
 *   use the same links but log against a separate `cid`.
 */
import { baseCampaignId } from "@/config/programmes";

export type LinkDestinationMap = Record<string, string>;

const BMJ_LYVDELZI = "https://hosted.bmj.com/gilead-lyvdelzi";
const BMJ_LYVDELZI_BIOCHEMICAL =
  "https://hosted.bmj.com/gilead-lyvdelzi#biochemical-levels";
const BMJ_AIDS_2026 = "https://hosted.bmj.com/gilead-aids2026";
const TOUCH_ID_FUNGI_NOW_EP1 =
  "https://touchinfectiousdiseases.com/sepsis/learning-zone/fungi-now-timely-insights-for-sharper-clinical-decision-making/?video_id=5e7qd9ryrs";
const LANCET_MICROBE_FUNGAL_2024 =
  "https://www.thelancet.com/journals/lanmic/article/PIIS2666-5247(24)00039-9/fulltext";
const TOUCH_ID_COVID_WEBINAR =
  "https://touchinfectiousdiseases.com/covid-19/learning-zone/evolving-management-of-covid-19-in-hospitalised-patients-evidence-experience-and-practice/?video_id=liwhmie1y0";

/**
 * Legacy fallback aliases, kept only for link IDs that may already be live in
 * mail sent before per-campaign maps existed.
 *
 * These apply ONLY to campaign IDs this app does not recognise (see
 * `getDestinationUrl`). A configured campaign never falls back here — a missing
 * link ID on a known campaign is a config error, and 404 is far safer than
 * silently redirecting a recipient to a different brand's content.
 */
export const defaultLinkDestinations: LinkDestinationMap = {
  "learn-more": BMJ_LYVDELZI,
  "hero-button": BMJ_LYVDELZI,
  "access-data": BMJ_LYVDELZI,
  "view-now": BMJ_LYVDELZI_BIOCHEMICAL,
};

/**
 * Per-campaign link maps.
 * Add each new wave with a unique campaign ID and explicit link IDs.
 */
export const campaignLinkDestinations: Record<string, LinkDestinationMap> = {
  // --- Gilead AmBisome (via IMI) -------------------------------------------
  // Populate one at a time as each final HTML lands, then hand the generated
  // URLs to the email build (/admin/setup/<cid>).
  // Email 1 (build file "Fungi Now Wave 1"): three CTAs.
  "gilead-ambisome-email-1": {
    // Episode 1 play-button image, upper body
    "episode-1-thumbnail": TOUCH_ID_FUNGI_NOW_EP1,
    // "Watch Episode 1 >" text button
    "watch-episode-1": TOUCH_ID_FUNGI_NOW_EP1,
    // "Read the full publication here" — Lancet Microbe 2024
    "read-publication": LANCET_MICROBE_FUNGAL_2024,
  },
  "gilead-ambisome-email-2": {},
  "gilead-ambisome-email-3": {},
  "gilead-ambisome-email-4": {},
  "gilead-ambisome-email-5": {},

  // --- Gilead Veklury (via IMI) -------------------------------------------
  // Email 1 (build file wave_4b): three image CTAs, all to the same webinar
  // page, given separate IDs so placement performance is visible.
  "gilead-veklury-email-1": {
    // Webinar screenshot with play button, top of the email
    "watch-webinar": TOUCH_ID_COVID_WEBINAR,
    // Left-hand speaker headshot
    "speaker-left": TOUCH_ID_COVID_WEBINAR,
    // Right-hand speaker headshot
    "speaker-right": TOUCH_ID_COVID_WEBINAR,
  },
  "gilead-veklury-email-2": {},
  "gilead-veklury-email-3": {},
  "gilead-veklury-email-4": {},
  "gilead-veklury-email-5": {},

  // --- IMI / Gilead Lyvdelzi ----------------------------------------------
  "imi-lyvdelzi-may-2026": {
    "see-recap": BMJ_LYVDELZI,
    "access-full-data": BMJ_LYVDELZI,
    "view-now-biochemical-levels": BMJ_LYVDELZI_BIOCHEMICAL,
    // Aliases that previously resolved via defaultLinkDestinations. Declared
    // explicitly so this wave keeps working under strict resolution.
    "learn-more": BMJ_LYVDELZI,
    "hero-button": BMJ_LYVDELZI,
    "access-data": BMJ_LYVDELZI,
    "view-now": BMJ_LYVDELZI_BIOCHEMICAL,
  },

  // --- IMI / Gilead AIDS 2026 ---------------------------------------------
  "imi-aids2026-pre-email-jun-2026": {
    "read-more": BMJ_AIDS_2026,
    "read-more1": BMJ_AIDS_2026,
    "read-more-1": BMJ_AIDS_2026,
    "read-more-2": BMJ_AIDS_2026,
    "learn-more": BMJ_AIDS_2026,
  },

  "imi-aids2026-post-congress-jul-2026": {
    "watch-the-symposium": BMJ_AIDS_2026,
    "featured-symposium-video": BMJ_AIDS_2026,
    "explore-the-talks": BMJ_AIDS_2026,
    "explore-aids2026-highlights": BMJ_AIDS_2026,
    continue_the_conversation: BMJ_AIDS_2026,
  },

  // Wave placeholder (fill when final HTML/links are ready)
  "imi-aids2026-wave-3": {},
};

/**
 * Resolve a link ID to its destination URL, or null if not allowlisted.
 *
 * Resolution order:
 *   1. The campaign's own map (`-test` IDs use their parent campaign's map).
 *   2. If the campaign is configured at all, stop — return null (404).
 *   3. Only for unrecognised campaign IDs, try the legacy fallback aliases.
 */
export function getDestinationUrl(
  linkId: string,
  campaignId?: string | null
): string | null {
  const normalizedLinkId = decodeURIComponent(linkId).trim();
  const normalizedCampaignId = campaignId?.trim() || null;

  if (normalizedCampaignId) {
    const key = baseCampaignId(normalizedCampaignId);
    const campaignMap = campaignLinkDestinations[key];

    if (campaignMap) {
      // Configured campaign: strict — never leak into another brand's links.
      return campaignMap[normalizedLinkId] ?? null;
    }
  }

  return defaultLinkDestinations[normalizedLinkId] ?? null;
}

/** Link IDs configured for one campaign (empty until its HTML is finalised). */
export function getCampaignLinkIds(campaignId: string): string[] {
  const map = campaignLinkDestinations[baseCampaignId(campaignId)];
  return map ? Object.keys(map).sort() : [];
}

/** The campaign's link ID -> destination map, or null if the cid is unknown. */
export function getCampaignLinkMap(
  campaignId: string
): LinkDestinationMap | null {
  return campaignLinkDestinations[baseCampaignId(campaignId)] ?? null;
}

