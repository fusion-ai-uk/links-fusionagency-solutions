/**
 * Allowlisted click-tracking destinations keyed by link ID.
 *
 * Update this file per campaign. Only link IDs defined here can be used
 * in tracked CTA URLs — arbitrary destination URLs in query strings are
 * never accepted (prevents open-redirect abuse).
 */
const BMJ_LYVDELZI = "https://hosted.bmj.com/gilead-lyvdelzi";
const BMJ_LYVDELZI_BIOCHEMICAL = "https://hosted.bmj.com/gilead-lyvdelzi#biochemical-levels";

export const linkDestinations: Record<string, string> = {
  // imi-lyvdelzi-may-2026 — sent email CTAs
  "see-recap": BMJ_LYVDELZI,
  "access-full-data": BMJ_LYVDELZI,
  "view-now-biochemical-levels": BMJ_LYVDELZI_BIOCHEMICAL,

  // Fallback aliases (testing or alternate link IDs)
  "learn-more": BMJ_LYVDELZI,
  "hero-button": BMJ_LYVDELZI,
  "access-data": BMJ_LYVDELZI,
  "view-now": BMJ_LYVDELZI_BIOCHEMICAL,
};

/** Resolve a link ID to its destination URL, or null if not allowlisted. */
export function getDestinationUrl(linkId: string): string | null {
  const normalized = decodeURIComponent(linkId).trim();
  return linkDestinations[normalized] ?? null;
}

/** All configured link IDs (useful for admin/docs). */
export function getLinkIds(): string[] {
  return Object.keys(linkDestinations);
}
