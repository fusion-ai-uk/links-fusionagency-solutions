/**
 * Allowlisted click-tracking destinations keyed by link ID.
 *
 * Update this file per campaign. Only link IDs defined here can be used
 * in tracked CTA URLs — arbitrary destination URLs in query strings are
 * never accepted (prevents open-redirect abuse).
 */
export const linkDestinations: Record<string, string> = {
  "hero-button":
    "https://example.com/landing-page?utm_source=imi&utm_medium=email&utm_campaign=test&utm_content=hero-button",
  "secondary-cta":
    "https://example.com/contact?utm_source=imi&utm_medium=email&utm_campaign=test&utm_content=secondary-cta",
};

/** Resolve a link ID to its destination URL, or null if not allowlisted. */
export function getDestinationUrl(linkId: string): string | null {
  return linkDestinations[linkId] ?? null;
}

/** All configured link IDs (useful for admin/docs). */
export function getLinkIds(): string[] {
  return Object.keys(linkDestinations);
}
