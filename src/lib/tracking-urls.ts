import { TRACKING_BASE_URL } from "@/config/site";

/** Open-tracking pixel URL for a campaign. */
export function buildPixelUrl(campaignId: string): string {
  return `${TRACKING_BASE_URL}/o?cid=${encodeURIComponent(campaignId)}`;
}

/** Click-tracking redirect URL for one CTA. */
export function buildClickUrl(linkId: string, campaignId: string): string {
  return `${TRACKING_BASE_URL}/c/${encodeURIComponent(
    linkId
  )}?cid=${encodeURIComponent(campaignId)}`;
}

/** The 1x1 pixel <img> tag to drop in before </body>. */
export function buildPixelSnippet(campaignId: string): string {
  return `<img src="${buildPixelUrl(
    campaignId
  )}" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />`;
}

/** A tracked anchor tag for one CTA. */
export function buildAnchorSnippet(
  linkId: string,
  campaignId: string,
  text = "CTA text"
): string {
  return `<a href="${buildClickUrl(linkId, campaignId)}">${text}</a>`;
}

/**
 * The full plain-text handover block for the email build.
 *
 * This is what gets pasted to the person building the HTML: the pixel, every
 * tracked CTA URL, and the standing rules about what must not be touched.
 */
export function buildHandoverText(options: {
  campaignLabel: string;
  campaignId: string;
  programmeLabel: string;
  linkIds: string[];
  destinations: Record<string, string>;
}): string {
  const { campaignLabel, campaignId, programmeLabel, linkIds, destinations } =
    options;

  const ctaLines = linkIds.length
    ? linkIds
        .map(
          (linkId) =>
            `  ${linkId}\n    tracked URL: ${buildClickUrl(
              linkId,
              campaignId
            )}\n    final destination: ${destinations[linkId] ?? "not set"}`
        )
        .join("\n")
    : "  (none configured yet — no CTAs to swap in this email)";

  return [
    `EMAIL TRACKING HANDOVER`,
    `Programme: ${programmeLabel}`,
    `Email: ${campaignLabel}`,
    `Campaign ID (cid): ${campaignId}`,
    ``,
    `1. OPEN TRACKING PIXEL`,
    `Add this once, immediately before </body>:`,
    ``,
    buildPixelSnippet(campaignId),
    ``,
    `2. TRACKED CTA LINKS`,
    `Replace the href on each matching CTA with the tracked URL below.`,
    `The final destination is where the recipient still ends up.`,
    ``,
    ctaLines,
    ``,
    `3. DO NOT CHANGE`,
    `- Unsubscribe links`,
    `- Preference centre links`,
    `- Legal, compliance or PI/adverse-event links`,
    `- Do not add raw email addresses or recipient data to any URL`,
    `- No merge tags are needed`,
    ``,
    `4. TEST BEFORE SEND`,
    `A test copy can be pointed at cid=${campaignId}-test so test opens and`,
    `clicks are recorded separately and never pollute the live figures.`,
  ].join("\n");
}
