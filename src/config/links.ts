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
  // --- Gilead AmBisome -----------------------------------------------------
  // Five emails in approval. Populate one at a time as each final HTML lands,
  // then hand the generated URLs to the email build (/admin/setup/<cid>).
  "gilead-ambisome-email-1": {},
  "gilead-ambisome-email-2": {},
  "gilead-ambisome-email-3": {},
  "gilead-ambisome-email-4": {},
  "gilead-ambisome-email-5": {},

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

/** All configured link IDs (optionally scoped to a specific campaign). */
export function getLinkIds(campaignId?: string): string[] {
  if (campaignId) {
    return getCampaignLinkIds(campaignId);
  }

  const ids = new Set<string>(Object.keys(defaultLinkDestinations));
  for (const map of Object.values(campaignLinkDestinations)) {
    for (const key of Object.keys(map)) ids.add(key);
  }
  return Array.from(ids).sort();
}
