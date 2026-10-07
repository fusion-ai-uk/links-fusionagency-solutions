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
/**
 * Fungi Now Episode 2, as built (Fungi Now Wave 2.html, GFM-UNB-2860).
 *
 * QUERY RAISED 2 October 2026: the video_id is identical to Episode 1's. On
 * this learning zone the video_id is the only thing distinguishing one film
 * from another on a shared page, so as built the Episode 2 buttons may open
 * Episode 1. Kept exactly as the build has it rather than guessed at — if a
 * different ID comes back, change it here and no rebuild is needed.
 */
const TOUCH_ID_FUNGI_NOW_EP2 =
  "https://touchinfectiousdiseases.com/sepsis/learning-zone/fungi-now-timely-insights-for-sharper-clinical-decision-making/?video_id=5e7qd9ryrs";
/** Lancet Infectious Diseases — ECMM guideline for invasive candidiasis. */
const LANCET_ID_CANDIDIASIS_2024 =
  "https://www.thelancet.com/journals/laninf/article/PIIS1473-3099(24)00749-7/fulltext";
const LANCET_MICROBE_FUNGAL_2024 =
  "https://www.thelancet.com/journals/lanmic/article/PIIS2666-5247(24)00039-9/fulltext";
const TOUCH_ID_COVID_WEBINAR =
  "https://touchinfectiousdiseases.com/covid-19/learning-zone/evolving-management-of-covid-19-in-hospitalised-patients-evidence-experience-and-practice/?video_id=liwhmie1y0";
// Same learning zone, a different video: the Gilead ESCMID 2025 symposium
// highlights. Note the video_id — it is what distinguishes this from the
// webinar used by the wave 4b email above.
const TOUCH_ID_COVID_ESCMID_HIGHLIGHTS =
  "https://touchinfectiousdiseases.com/covid-19/learning-zone/evolving-management-of-covid-19-in-hospitalised-patients-evidence-experience-and-practice/?video_id=wrnbt1y7iu";
const GRAYLING_COVID_POLICY_PAPER =
  "https://grayling.com/wp-content/uploads/2025/03/Covid-report-2_final_5.pdf";

/**
 * HIV Glasgow pre-email destination, confirmed by Steve on 30 September 2026.
 * It replaces the congress site (hivglasgow.org) that stood in while the
 * destination was unknown.
 *
 * Note the slug: glasgow2026, not hivglasgow — which is why searching for the
 * latter found nothing.
 *
 * NOT YET PUBLISHED. As of 30 September 2026 this URL answers 404 while
 * hosted.bmj.com itself answers 200 and gilead-aids2026 answers 403 (exists,
 * blocks robots). BMJ have evidently not put the Glasgow page up yet, which is
 * unremarkable for a congress on 8-11 November. It must be live before this
 * email sends, or every click lands on a BMJ 404 — worth re-checking as part
 * of the pre-send tests.
 */
const BMJ_GILEAD_GLASGOW_2026 = "https://hosted.bmj.com/gilead-glasgow2026";

/**
 * Act Now on PBC (via Inizio). Stored over https: the build uses http:// on
 * some links and hosted.bmj.com 301s those to https anyway, so this drops a
 * needless hop and the mixed-scheme warning some clients show.
 */
const PBC_ACT_NOW_INSIGHTS = "https://hosted.bmj.com/act-now-on-pbc#latestinsights";
const PBC_PPAR_ROLE =
  "https://hosted.bmj.com/act-now-on-pbc/new-ppar-possibilities#roleofpparsinpbc";
/**
 * Treatment goals on the second-line escalation page. Confirmed by Steve on
 * 7 October 2026 as the destination for the Watch video button.
 */
const PBC_SECOND_LINE_GOALS =
  "https://hosted.bmj.com/act-now-on-pbc/second-line-escalation#treatmentgoals";

/**
 * Takeda Sleep Academy. Two distinct destinations — note the different casing
 * and separators, which is exactly the sort of thing that gets mistyped:
 */
const TAKEDA_WEBINAR_REG = "https://cloud.takeda-uk.com/Sleep_Academy_Webinar_Registration";
const TAKEDA_ACADEMY_REG = "https://cloud.takeda-uk.com/sleep-academy-registration";

/**
 * Takeda's Matomo campaign parameters, in the order and spelling the builds
 * use. `mtm_content` is empty in every build and `mtm_group` is empty on the
 * Join CTA; both are kept rather than dropped so the query string matches
 * what Takeda expect to receive.
 */
function takedaParams(placement: string, group: string, source = "thirdparty"): string {
  return [
    `mtm_source=${source}`,
    "mtm_medium=email",
    "mtm_campaign=Narcolepsy_GB_Education_Webinar_042026",
    "mtm_kwd=Other",
    "mtm_cid=a1Ubi000002OOMbEAO",
    "mtm_content=",
    `mtm_placement=${placement}`,
    `mtm_group=${group}`,
  ].join("&");
}

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
  // Email 2 (build file "Fungi Now Wave 2", GFM-UNB-2860): three CTAs, two
  // destinations — the same shape as email 1.
  "gilead-ambisome-email-2": {
    // Episode 2 play-button image
    "episode-2-thumbnail": TOUCH_ID_FUNGI_NOW_EP2,
    // "Watch Episode 2 >" text button
    "watch-episode-2": TOUCH_ID_FUNGI_NOW_EP2,
    // "Read the full publication here →" — ECMM invasive candidiasis guideline
    "read-publication": LANCET_ID_CANDIDIASIS_2024,
  },
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
  // Wave 1, the whitepaper email (build file Wave_1_Whitepaper, GFM-VKY-0091,
  // October 2026). Two CTAs, both destinations taken from the build itself.
  "gilead-veklury-wave-1-whitepaper": {
    // "WATCH NOW" — ESCMID 2025 symposium highlights, 4-min watch
    "watch-now-symposium": TOUCH_ID_COVID_ESCMID_HIGHLIGHTS,
    // The video still itself, linked as well as the button (added 1 October
    // 2026 at Steve's request). Same destination as the button deliberately
    // given its own ID: sharing one would merge the two placements and we
    // could no longer tell whether the image or the button earned the click.
    "symposium-video-image": TOUCH_ID_COVID_ESCMID_HIGHLIGHTS,
    // "Click here to download the policy paper >" — Grayling COVID policy paper
    "download-policy-paper": GRAYLING_COVID_POLICY_PAPER,
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

  // --- Act Now on PBC (via Inizio) ----------------------------------------
  // Email 3, the website build phase 3 (build file index.html, GFM-UNB-2857).
  // Three visible buttons, but TWELVE hrefs: every button is built twice, an
  // Outlook <v:rect> and an ordinary <a>, and each of those carries the label
  // and the arrow as separate links. All four hrefs behind a button must get
  // that button's URL, or Outlook readers slip past tracking entirely.
  //
  // All three destinations confirmed by Steve on 7 October 2026, which
  // resolved an inconsistency in the build worth recording.
  //
  // The build had the URLs shifted by one button. Watch video carried the
  // PPAR page (which belongs to Watch PPAR video), and the escalation page
  // it should have carried turned up instead on two of the four hrefs behind
  // Visit website. That stray URL was flagged at the time as "Visit website
  // disagrees with itself" — but the two halves of the problem were treated
  // as separate, and Watch video was configured as built because all four of
  // its hrefs agreed with each other. Agreeing is not the same as correct.
  "pbc-act-now-email-3": {
    // "Visit website" — the site's latest insights
    "visit-website": PBC_ACT_NOW_INSIGHTS,
    // "Watch video" — Professor Calvaruso on treatment escalation
    "watch-video-calvaruso": PBC_SECOND_LINE_GOALS,
    // "Watch PPAR video" — therapeutic potential of PPARs
    "watch-ppar-video": PBC_PPAR_ROLE,
  },

  // --- Act Now on PBC, TrendMD native ads (via Digital Peloton) -----------
  // A native text ad allows two clickable links, one in the headline and one
  // in the byline, so each gets its own ID and the two report separately.
  //
  // Unlike an email link, these may arrive with the ad server's own campaign
  // parameters appended at click time. The redirect now carries recognised
  // ones through to the destination (src/lib/forward-params.ts); the stored
  // URL still decides where the reader lands.
  "pbc-act-now-trendmd-1": {
    "native-headline": PBC_ACT_NOW_INSIGHTS,
    "native-byline": PBC_ACT_NOW_INSIGHTS,
  },

  // --- Takeda Sleep Academy (via IMI) -------------------------------------
  // Three waves, three CTAs each, all on cloud.takeda-uk.com. Two pages are
  // involved and they are easy to confuse:
  //   /Sleep_Academy_Webinar_Registration  — the webinar sign-up
  //   /sleep-academy-registration          — joining the Academy itself
  //
  // Every destination carries Takeda's Matomo campaign parameters. They are
  // reproduced verbatim from each build, including the empty mtm_content and
  // mtm_group: these feed Takeda's own attribution, mtm_placement identifies
  // the wave, and changing or dropping one would break their reporting.
  "takeda-sleep-academy-wave-1": {
    // "REGISTER FOR THE EXPERT-LED WEBINARS →", upper button
    "register-webinar-1": `${TAKEDA_WEBINAR_REG}?${takedaParams("Wave1", "All")}`,
    // the same CTA repeated lower down the email
    "register-webinar-2": `${TAKEDA_WEBINAR_REG}?${takedaParams("Wave1", "All")}`,
    // "JOIN THE SLEEP ACADEMY →"
    "join-sleep-academy": `${TAKEDA_ACADEMY_REG}?${takedaParams("Wave1", "")}`,
  },
  "takeda-sleep-academy-wave-2": {
    // "REGISTER FOR THE FREE WEBINAR →"
    "register-webinar-1": `${TAKEDA_WEBINAR_REG}?${takedaParams("Wave2", "All")}`,
    // "REGISTER HERE →"
    "register-webinar-2": `${TAKEDA_WEBINAR_REG}?${takedaParams("Wave2", "All")}`,
    // "JOIN THE SLEEP ACADEMY →"
    "join-sleep-academy": `${TAKEDA_ACADEMY_REG}?${takedaParams("Wave2", "")}`,
  },
  "takeda-sleep-academy-wave-3": {
    // "SECURE YOUR PLACE HERE →", upper button
    "register-webinar-1": `${TAKEDA_WEBINAR_REG}?${takedaParams("Wave3", "All")}`,
    // the same CTA repeated lower down the email
    "register-webinar-2": `${TAKEDA_WEBINAR_REG}?${takedaParams("Wave3", "All")}`,
    // "JOIN THE SLEEP ACADEMY →". mtm_source is empty in the wave 3 build
    // where waves 1 and 2 send "thirdparty". Reproduced as built rather than
    // silently corrected — it is Takeda's attribution to decide on.
    "join-sleep-academy": `${TAKEDA_ACADEMY_REG}?${takedaParams("Wave3", "", "")}`,
  },

  // --- IMI / Gilead HIV Glasgow -------------------------------------------
  // Four CTAs in the build (index 3.html, September 2026, GFM-UNB-3012):
  //   header-banner                — hero image at the top, alt "let's talk"
  //   symposium-ageing-well        — "Read more", Ageing well with HIV (Sun 8 Nov)
  //   symposium-prevention-paradox — "Read more", The Prevention Paradox (Mon 9 Nov)
  //   booth-801-talks              — "Learn more", Booth 801 theatre programme
  // Those IDs are fixed and have gone to the email build, so they must not be
  // renamed.
  //
  // All four go to the Gilead Glasgow 2026 hub. Separate IDs are kept even
  // though the destination is shared, so the four placements report
  // independently and can diverge later without rebuilding the email.
  "imi-hivglasgow-pre-email-2026": {
    "header-banner": BMJ_GILEAD_GLASGOW_2026,
    "symposium-ageing-well": BMJ_GILEAD_GLASGOW_2026,
    "symposium-prevention-paradox": BMJ_GILEAD_GLASGOW_2026,
    "booth-801-talks": BMJ_GILEAD_GLASGOW_2026,
  },
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

