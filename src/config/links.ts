/**
 * Allowlisted click-tracking destinations.
 *
 * - Campaign-specific maps let us run concurrent email waves safely.
 * - Default links are fallbacks used when a campaign-specific ID is not found.
 * - Arbitrary destination URLs from query strings are NEVER accepted.
 */
export type LinkDestinationMap = Record<string, string>;

const BMJ_LYVDELZI = "https://hosted.bmj.com/gilead-lyvdelzi";
const BMJ_LYVDELZI_BIOCHEMICAL =
  "https://hosted.bmj.com/gilead-lyvdelzi#biochemical-levels";
const BMJ_AIDS_2026 = "https://hosted.bmj.com/gilead-aids2026";

/**
 * Legacy/default fallback link IDs.
 */
export const defaultLinkDestinations: LinkDestinationMap = {
  // lyvdelzi wave fallback aliases
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
  // Existing campaign
  "imi-lyvdelzi-may-2026": {
    "see-recap": BMJ_LYVDELZI,
    "access-full-data": BMJ_LYVDELZI,
    "view-now-biochemical-levels": BMJ_LYVDELZI_BIOCHEMICAL,
  },

  // New wave: AIDS 2026 pre-email
  "imi-aids2026-pre-email-jun-2026": {
    "read-more": BMJ_AIDS_2026,
    "read-more-1": BMJ_AIDS_2026,
    "read-more-2": BMJ_AIDS_2026,
    "learn-more": BMJ_AIDS_2026,
  },

  // New wave: AIDS 2026 post-congress
  "imi-aids2026-post-congress-jul-2026": {
    "watch-the-symposium": BMJ_AIDS_2026,
    "featured-symposium-video": BMJ_AIDS_2026,
    "explore-the-talks": BMJ_AIDS_2026,
    "explore-aids2026-highlights": BMJ_AIDS_2026,
    "continue_the_conversation": BMJ_AIDS_2026,
  },

  // Wave placeholder (fill when final HTML/links are ready)
  "imi-aids2026-wave-3": {},
};

/** Resolve a link ID to its destination URL, or null if not allowlisted. */
export function getDestinationUrl(
  linkId: string,
  campaignId?: string | null
): string | null {
  const normalizedLinkId = decodeURIComponent(linkId).trim();
  const normalizedCampaignId = campaignId?.trim() || null;

  if (normalizedCampaignId) {
    const campaignMap = campaignLinkDestinations[normalizedCampaignId];
    if (campaignMap && campaignMap[normalizedLinkId]) {
      return campaignMap[normalizedLinkId];
    }
  }

  return defaultLinkDestinations[normalizedLinkId] ?? null;
}

/** All configured link IDs (optionally scoped to a specific campaign). */
export function getLinkIds(campaignId?: string): string[] {
  const ids = new Set<string>(Object.keys(defaultLinkDestinations));
  if (campaignId && campaignLinkDestinations[campaignId]) {
    for (const key of Object.keys(campaignLinkDestinations[campaignId])) {
      ids.add(key);
    }
  } else {
    for (const map of Object.values(campaignLinkDestinations)) {
      for (const key of Object.keys(map)) ids.add(key);
    }
  }
  return Array.from(ids).sort();
}
