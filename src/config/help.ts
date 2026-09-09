/**
 * Explanatory copy for the dashboard.
 *
 * One source of truth for every info tooltip and the /admin/guide page, so the
 * caveats stay consistent wherever a figure appears. Written for colleagues who
 * are not analysts: say what the number is, then say what it is not.
 *
 * Keep to the house style — UK English, plain, no overclaiming, and never state
 * a figure as certain when it is an estimate.
 */

export interface HelpEntry {
  /** Heading used on the guide page. */
  label: string;
  /** One or two sentences. Shown in the tooltip. */
  short: string;
  /** Longer explanation, shown on the guide page only. */
  detail?: string[];
}

export const HELP = {
  totalOpens: {
    label: "Total opens",
    short:
      "Every time the tracking pixel loaded. This is an estimate, not a count of people — it under-counts and over-counts at the same time.",
    detail: [
      "An open is recorded when the 1×1 image in the email is requested. That is the only signal available without recipient IDs.",
      "It under-counts because many mail clients block images by default, so a real read can leave no trace at all.",
      "It over-counts because one person reading an email three times is three opens, and because Apple Mail Privacy Protection and Gmail pre-load images through their own servers whether or not anyone has read the message.",
      "Treat opens as a directional signal about reach. Clicks are the stronger evidence of engagement.",
    ],
  },

  totalClicks: {
    label: "Total clicks",
    short:
      "Every time a tracked link was followed. More reliable than opens, because a click needs a deliberate action.",
    detail: [
      "A click is recorded when someone follows one of the tracked links, immediately before they are redirected to the real destination.",
      "Repeat clicks by the same person are all counted, so this is clicks, not clickers.",
      "Only links that have been set up for that email are tracked. Unsubscribe, preference centre and legal links are deliberately never tracked.",
    ],
  },

  approxUnique: {
    label: "Approximate unique",
    short:
      "An attempt to collapse repeats, by counting distinct combinations of hashed IP address and browser/mail client. It is not a count of people and must never be reported as one.",
    detail: [
      "Without recipient IDs we cannot tell two people apart, so this is the closest available proxy: distinct hashed IP plus user agent, within the same email and event type.",
      "It over-counts when one person's address changes — reading on mobile data and then on office wi-fi looks like two different people.",
      "It under-counts when many people share one address, which is normal inside a hospital, a trust or any large office network. A whole department can appear as one.",
      "Use it to sense-check whether a total is driven by a handful of sources or a broad spread. Do not put it in a client report as a recipient number.",
    ],
  },

  clicksPerOpen: {
    label: "Clicks per open",
    short:
      "Total clicks divided by total opens. A rough ratio only — it can legitimately exceed 100%, so it is not a click-through rate.",
    detail: [
      "This is not the click-through rate an email platform would report, because the denominator is estimated opens rather than delivered emails.",
      "It can go above 100%. Clicks almost always register, whereas opens are lost whenever images are blocked, so the denominator is the unreliable half of the sum.",
      "It is useful for comparing emails within the same programme, where the same distortions apply to both. It is not a figure to quote in isolation.",
    ],
  },

  bots: {
    label: "Likely bots and scanners",
    short:
      "Security scanners, link checkers and crawlers request tracking pixels and follow links. We flag them by user agent and never block them.",
    detail: [
      "Corporate mail security commonly opens every email and visits every link before a recipient sees it. That activity is real traffic but it is not a person engaging.",
      "Events are flagged using a list of known bot and scanner user agents. The check is a heuristic: it will miss some and may occasionally flag a genuine client.",
      "Ticking Exclude likely bots removes flagged rows from every figure on screen and from the CSV export. It is off by default so that headline numbers stay comparable with anything reported previously.",
    ],
  },

  testSends: {
    label: "Test sends",
    short:
      "Any campaign ID ending -test. Test traffic is kept out of the live figures unless you ask for it.",
    detail: [
      "Before an email goes out we send test copies internally. Those opens and clicks are real events but they are ours, not the audience's.",
      "A test build points at the same campaign ID with -test on the end. It uses the same tracked destinations, so the test genuinely exercises the live links.",
      "Test data is excluded from every figure by default. Tick Include test sends to see it, for example when confirming a test actually registered.",
    ],
  },

  campaignId: {
    label: "Campaign ID (cid)",
    short:
      "The identifier that ties every event back to one specific email. It appears in the tracking URLs inside that email's HTML.",
    detail: [
      "One email equals one campaign ID. It is set once, embedded in the email HTML, and cannot be changed after the email is sent.",
      "Reporting is grouped by this ID, which is why each email gets its own rather than sharing one across a programme.",
      "If a campaign ID is mistyped during the email build, its events still record — they simply appear under Unassigned rather than against the intended email.",
    ],
  },

  linkId: {
    label: "Link ID",
    short:
      "A short name for one call to action within an email. Clicks are grouped by it, so the names decide how readable the report is.",
    detail: [
      "Each tracked button or link in an email gets its own ID, chosen to describe the call to action — for example watch-the-symposium.",
      "The same link ID may be used in more than one email. Counts shown here are only for the emails in the current view, so switching programme changes them.",
      "Only allowlisted link IDs work. An ID that is not configured returns a not-found page rather than redirecting, which prevents a recipient ever being sent to another brand's content by mistake.",
    ],
  },

  unassigned: {
    label: "Unassigned",
    short:
      "Campaign IDs found in the data that no programme claims. Usually a typo in an email build, a legacy send, or a pixel called without an ID.",
    detail: [
      "This section exists so nothing is silently lost. Any tracking event with an unrecognised ID still records and still shows up here.",
      "unknown means the tracking pixel or link was requested with no campaign ID at all.",
      "If an ID here looks like a near-miss of a real one, the email build most likely carries a typo. Worth checking before the next send in that programme.",
    ],
  },

  status: {
    label: "Status",
    short:
      "Where the email sits in the approval and setup process. Maintained by hand, so it reflects what we know rather than anything automatic.",
    detail: [
      "Planned — the slot is reserved and nothing can be configured yet, because the content has not arrived.",
      "In review — content received, still going through client, medical or legal review.",
      "Ready to send — tracking is configured and the pack has gone to the email build.",
      "Sent — the email has gone out and is collecting data.",
      "Closed — the send is finished and reporting is signed off.",
    ],
  },

  trackedCtas: {
    label: "Tracked CTAs",
    short:
      "How many calls to action in this email have a tracked link configured. Open tracking works without any of this; click tracking does not.",
    detail: [
      "Not set up is the correct and expected state while an email is still in approval.",
      "Until at least one call to action is configured, clicks in that email cannot be attributed to anything.",
      "The pixel is independent. Open tracking starts working the moment the pixel is in the HTML, whether or not any links are set up.",
    ],
  },

  location: {
    label: "Location",
    short:
      "A coarse country, region or city guess from the network the request came from. Often the location of a mail provider's server rather than a person.",
    detail: [
      "Location comes from the edge network handling the request. It is approximate by design.",
      "Where a mail client proxies images, the location reflects that proxy — commonly a data centre in another country entirely.",
      "No exact IP address is ever stored. Addresses are one-way hashed before they reach the database.",
    ],
  },

  recentEvents: {
    label: "Recent events",
    short:
      "The latest 50 individual events in the current view, newest first. Times are UTC.",
    detail: [
      "This is the raw feed, useful for confirming that a change has taken effect or that a test has registered.",
      "During British Summer Time, UTC is one hour behind local time.",
      "For anything beyond the latest 50, use the CSV export.",
    ],
  },

  csvExport: {
    label: "CSV export",
    short:
      "Downloads the individual events behind the current view, with the same programme, bot and test filters applied.",
    detail: [
      "The export always matches what is on screen, so a filtered view gives a filtered file.",
      "It contains hashed IP addresses and full user agent strings. Treat the file as internal, and do not forward it outside Fusion without checking first.",
    ],
  },

  duplication: {
    label: "Why figures repeat and diverge",
    short:
      "The same person can appear several times in the same figure, and the same event can be counted differently in two places. Both are expected.",
    detail: [
      "One person opening an email four times contributes four total opens. Nothing de-duplicates the headline figures, by design — they are event counts.",
      "Approximate unique tries to collapse those repeats but does so imperfectly, so it will rarely equal the number of real people.",
      "Programme-level approximate uniques are not the sum of their emails. Somebody who opened two emails in a programme is one unique at programme level and one in each email, so the parts add up to more than the whole.",
      "A single click also produces no open, and a single open produces no click. The two are recorded independently, so an email can show clicks from someone whose open was never registered.",
    ],
  },

  programme: {
    label: "Programme",
    short:
      "A client and brand, holding all of that brand's emails. Selecting one narrows every figure on the page to it.",
    detail: [
      "Programmes keep each piece of client work separate, so figures for one brand can never be mixed into another's reporting.",
      "All programmes gives a service-wide view. It is useful for a sense of overall volume and not much else, because it mixes unrelated audiences.",
    ],
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof HELP;

/** Order used on the guide page. */
export const GUIDE_ORDER: HelpId[] = [
  "programme",
  "campaignId",
  "status",
  "trackedCtas",
  "totalOpens",
  "totalClicks",
  "approxUnique",
  "clicksPerOpen",
  "duplication",
  "bots",
  "testSends",
  "linkId",
  "unassigned",
  "location",
  "recentEvents",
  "csvExport",
];

/**
 * The standing source line for every figure in this dashboard.
 * Per the deck: a number with no source line is not finished.
 */
export const SOURCE_LINE =
  "Source: Fusion Data & AI — 1st-party email tracking activity. " +
  "Opens are estimated; approximate unique counts are a directional " +
  "de-duplication of hashed IP and user agent, not recipient counts.";
